import Fastify from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import { createHealthPayload } from "@partsagricola/shared";
import type { AuthConfig } from "./config.js";
import {
  digestCpf,
  digestLookup,
  digestToken,
  randomOpaqueToken,
} from "./crypto.js";
import { oidcDiscovery, validateAuthorize } from "./oidc.js";
import { verifyPassword } from "./passwords.js";
import type { AuthRepository, SessionContext } from "./repository.js";
import {
  pkceChallenge,
  type AccessClaims,
  type TokenService,
} from "./tokens.js";
import { loginView } from "./views.js";
import { TotpService } from "./totp.js";
import { AccountService } from "./accounts.js";
import { MemoryMailTransport, SmtpMailTransport } from "./mailer.js";
import {
  exchangeSocialCode,
  resolveConnectors,
  socialSignupDecision,
} from "./social.js";

export type AuthAppOptions = {
  config: AuthConfig;
  repository: AuthRepository;
  tokens: TokenService;
};

export function createApp(options?: AuthAppOptions) {
  const app = Fastify({
    logger: {
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "body.password",
        "body.code",
        "body.refresh_token",
      ],
    },
  });
  void app.register(cookie);
  void app.register(formbody);
  app.get("/health", async () => createHealthPayload("auth"));
  const issuer = options?.config.issuer ?? new URL("http://localhost:4101");
  app.get("/.well-known/openid-configuration", async () =>
    oidcDiscovery(issuer),
  );
  app.get("/.well-known/jwks.json", async (_request, reply) =>
    options
      ? options.tokens.jwks()
      : reply.code(503).send({ error: "not_configured" }),
  );
  app.get("/login", async (request, reply) =>
    reply.type("text/html; charset=utf-8").send(
      loginView({
        locale: request.headers["accept-language"],
        transaction: (request.query as { transaction?: string }).transaction,
      }),
    ),
  );

  app.get("/authorize", async (request, reply) => {
    if (!options) return reply.code(503).send({ error: "not_configured" });
    try {
      const parsed = validateAuthorize(
        new URLSearchParams(request.query as Record<string, string>),
      );
      if (
        !(await options.repository.validateClient(
          parsed.clientId,
          parsed.redirectUri,
          parsed.scopes,
        ))
      )
        return reply.code(400).send({ error: "invalid_client" });
      const handle = randomOpaqueToken();
      await options.repository.createAuthorizationTransaction({
        ...parsed,
        handleHash: digestToken(handle),
        expiresAt: new Date(Date.now() + 600_000),
      });
      const connectors = resolveConnectors(
        await options.repository.listEnabledConnectors(),
        process.env,
      ).map((item) => item.provider);
      return reply.type("text/html; charset=utf-8").send(
        loginView({
          locale: request.headers["accept-language"],
          transaction: handle,
          connectors,
        }),
      );
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "invalid_request",
      });
    }
  });

  app.post("/login", async (request, reply) => {
    if (!options) return reply.code(503).send({ error: "not_configured" });
    const body = request.body as {
      identifier?: string;
      password?: string;
      transaction?: string;
      totp?: string;
    };
    if (!body.identifier || !body.password || !body.transaction)
      return reply.code(400).send({ error: "invalid_request" });
    const identifier = body.identifier.trim();
    const attemptAt = new Date();
    const identifierHash = digestLookup(identifier, options.config.lookupKey);
    const ipHash = digestLookup(request.ip, options.config.lookupKey);
    if (
      await options.repository.isLoginRateLimited(
        identifierHash,
        ipHash,
        attemptAt,
      )
    )
      return reply.code(429).send({ error: "rate_limited" });
    let credential = null;
    try {
      credential = identifier.includes("@")
        ? await options.repository.findCredentialByEmail(identifier)
        : await options.repository.findCredentialByCpf(
            digestCpf(identifier, options.config.lookupKey),
          );
    } catch {
      /* identical failure response */
    }
    if (
      !credential?.passwordHash ||
      !(await verifyPassword(credential.passwordHash, body.password))
    ) {
      await options.repository.recordLoginAttempt(
        identifierHash,
        ipHash,
        false,
        attemptAt,
      );
      return reply
        .code(401)
        .type("text/html; charset=utf-8")
        .send(
          loginView({
            transaction: body.transaction,
            error: "Credenciais inválidas.",
          }),
        );
    }
    await options.repository.recordLoginAttempt(
      identifierHash,
      ipHash,
      true,
      attemptAt,
    );
    const privileged = credential.roles.some(
      (role) => role === "ADMIN" || role === "FINANCE",
    );
    let secondFactorAt: Date | undefined;
    if (privileged) {
      if (!credential.totpEnabled || !credential.totpSecretEncrypted)
        return reply.code(403).send({ error: "totp_enrollment_required" });
      if (!body.totp) return reply.code(401).send({ error: "totp_required" });
      const totp = new TotpService(options.config.dataKey);
      let valid = await totp.verify(credential.totpSecretEncrypted, body.totp);
      if (!valid) {
        const recovery = totp.useRecoveryCode(
          credential.recoveryCodeHashes,
          body.totp,
        );
        valid = recovery.valid;
        if (valid)
          await options.repository.replaceRecoveryHashes(
            credential.userId,
            recovery.remainingHashes,
          );
      }
      if (!valid) return reply.code(401).send({ error: "invalid_totp" });
      secondFactorAt = new Date();
    }
    const now = new Date();
    const sessionToken = randomOpaqueToken();
    const session = await options.repository.createSession({
      userId: credential.userId,
      tokenHash: digestToken(sessionToken),
      idleExpiresAt: new Date(now.getTime() + 1_800_000),
      expiresAt: new Date(now.getTime() + 43_200_000),
      ...(secondFactorAt ? { secondFactorAt } : {}),
    });
    const code = randomOpaqueToken();
    const complete = await options.repository.completeAuthorization({
      handleHash: digestToken(body.transaction),
      codeHash: digestToken(code),
      userId: credential.userId,
      sessionId: session.id,
      now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    if (!complete) {
      await options.repository.revokeSession(session.id, now);
      return reply.code(400).send({ error: "invalid_transaction" });
    }
    reply.setCookie("pa_sso", sessionToken, {
      httpOnly: true,
      secure: options.config.cookieSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 43_200,
    });
    const redirect = new URL(complete.redirectUri);
    redirect.searchParams.set("code", code);
    if (complete.state) redirect.searchParams.set("state", complete.state);
    return reply.redirect(redirect.href);
  });

  app.post("/token", async (request, reply) => {
    if (!options) return reply.code(503).send({ error: "not_configured" });
    const body = request.body as Record<string, string | undefined>;
    if (body.grant_type === "authorization_code") {
      if (
        !body.code ||
        !body.client_id ||
        !body.redirect_uri ||
        !body.code_verifier
      )
        return reply.code(400).send({ error: "invalid_request" });
      const exchange = await options.repository.consumeAuthorizationCode({
        codeHash: digestToken(body.code),
        clientId: body.client_id,
        redirectUri: body.redirect_uri,
        codeChallenge: pkceChallenge(body.code_verifier),
        now: new Date(),
      });
      if (!exchange) return reply.code(400).send({ error: "invalid_grant" });
      const session = await options.repository.getSessionById(
        exchange.sessionId,
        new Date(),
      );
      if (!session) return reply.code(400).send({ error: "invalid_grant" });
      return issueTokens(
        options,
        session,
        body.client_id,
        exchange.scopes,
        exchange.nonce,
      );
    }
    if (body.grant_type === "refresh_token") {
      if (!body.refresh_token)
        return reply.code(400).send({ error: "invalid_request" });
      const replacement = randomOpaqueToken();
      const rotated = await options.repository.rotateRefreshToken({
        currentHash: digestToken(body.refresh_token),
        replacementHash: digestToken(replacement),
        now: new Date(),
        expiresAt: new Date(Date.now() + 2_592_000_000),
      });
      if (
        rotated.status !== "rotated" ||
        !rotated.sessionId ||
        !rotated.clientId ||
        !rotated.scopes
      )
        return reply.code(400).send({ error: "invalid_grant" });
      const session = await options.repository.getSessionById(
        rotated.sessionId,
        new Date(),
      );
      if (!session) return reply.code(400).send({ error: "invalid_grant" });
      return issueTokens(
        options,
        session,
        rotated.clientId,
        rotated.scopes,
        null,
        replacement,
      );
    }
    return reply.code(400).send({ error: "unsupported_grant_type" });
  });

  app.post("/session/introspect", async (request) => {
    if (!options) return { active: false };
    const token = (request.body as { token?: string })?.token;
    if (!token) return { active: false };
    try {
      const claims = await options.tokens.verify(token);
      const session =
        typeof claims.sid === "string"
          ? await options.repository.getSessionById(claims.sid, new Date())
          : null;
      return session
        ? {
            active: true,
            sub: session.userId,
            sid: session.id,
            roles: session.roles,
            seller_ids: session.sellerIds,
            email: session.email,
            email_verified: session.emailVerified,
            scope: claims.scope,
          }
        : { active: false };
    } catch {
      return { active: false };
    }
  });

  app.get("/userinfo", async (request, reply) => {
    if (!options) return reply.code(503).send({ error: "not_configured" });
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer "))
      return reply.code(401).send({ error: "invalid_token" });
    try {
      const claims = await options.tokens.verify(authorization.slice(7));
      const session =
        typeof claims.sid === "string"
          ? await options.repository.getSessionById(claims.sid, new Date())
          : null;
      return session
        ? {
            sub: session.userId,
            email: session.email,
            email_verified: session.emailVerified,
            roles: session.roles,
            seller_ids: session.sellerIds,
          }
        : reply.code(401).send({ error: "invalid_token" });
    } catch {
      return reply.code(401).send({ error: "invalid_token" });
    }
  });

  app.post("/accounts/register", async (request, reply) => {
    if (!options) return reply.code(503).send({ error: "not_configured" });
    const body = request.body as {
      email?: string;
      name?: string;
      password?: string;
      cpf?: string;
    };
    if (!body.email || !body.name || !body.password)
      return reply.code(400).send({ error: "invalid_request" });
    const accounts = new AccountService(
      options.repository,
      options.config.smtpUrl
        ? new SmtpMailTransport(options.config.smtpUrl)
        : new MemoryMailTransport(),
      options.config.lookupKey,
      options.config.issuer,
    );
    try {
      return reply.code(201).send(
        await accounts.register({
          email: body.email,
          name: body.name,
          password: body.password,
          ...(body.cpf ? { cpf: body.cpf } : {}),
        }),
      );
    } catch {
      return reply.code(400).send({ error: "registration_failed" });
    }
  });
  app.post("/accounts/forgot-password", async (request, reply) => {
    if (!options) return reply.code(503).send({ error: "not_configured" });
    const email = (request.body as { email?: string }).email;
    if (email) {
      const accounts = new AccountService(
        options.repository,
        options.config.smtpUrl
          ? new SmtpMailTransport(options.config.smtpUrl)
          : new MemoryMailTransport(),
        options.config.lookupKey,
        options.config.issuer,
      );
      await accounts.requestPasswordReset(email);
    }
    return reply.code(202).send({ accepted: true });
  });

  app.post("/accounts/verify-email", async (request, reply) => {
    if (!options) return reply.code(503).send({ error: "not_configured" });
    const token = (request.body as { token?: string }).token;
    if (!token) return reply.code(400).send({ error: "invalid_request" });
    const accounts = new AccountService(
      options.repository,
      new MemoryMailTransport(),
      options.config.lookupKey,
      options.config.issuer,
    );
    return (await accounts.verifyEmail(token))
      ? { verified: true }
      : reply.code(400).send({ error: "invalid_or_expired_token" });
  });

  app.post("/accounts/reset-password", async (request, reply) => {
    if (!options) return reply.code(503).send({ error: "not_configured" });
    const body = request.body as { token?: string; password?: string };
    if (!body.token || !body.password)
      return reply.code(400).send({ error: "invalid_request" });
    const accounts = new AccountService(
      options.repository,
      new MemoryMailTransport(),
      options.config.lookupKey,
      options.config.issuer,
    );
    try {
      return (await accounts.resetPassword(body.token, body.password))
        ? { reset: true }
        : reply.code(400).send({ error: "invalid_or_expired_token" });
    } catch {
      return reply.code(400).send({ error: "password_policy" });
    }
  });

  app.post("/accounts/totp/enroll", async (request, reply) => {
    if (!options) return reply.code(503).send({ error: "not_configured" });
    const raw = request.cookies.pa_sso;
    const session = raw
      ? await options.repository.getSession(digestToken(raw), new Date())
      : null;
    if (!session)
      return reply.code(401).send({ error: "authentication_required" });
    const enrollment = await new TotpService(options.config.dataKey).enroll(
      session.email,
    );
    await options.repository.setTotp(
      session.userId,
      enrollment.encryptedSecret,
      enrollment.recoveryCodeHashes,
    );
    return {
      uri: enrollment.uri,
      secret: enrollment.secret,
      recovery_codes: enrollment.recoveryCodes,
    };
  });

  app.get<{ Params: { provider: string } }>(
    "/social/:provider",
    async (request, reply) => {
      if (!options) return reply.code(503).send({ error: "not_configured" });
      const transaction = (request.query as { transaction?: string })
        .transaction;
      const provider = request.params.provider.toUpperCase();
      const connector = resolveConnectors(
        await options.repository.listEnabledConnectors(),
        process.env,
      ).find((item) => item.provider === provider);
      if (!transaction || !connector)
        return reply.code(404).send({ error: "connector_unavailable" });
      if (options.config.socialMockEnabled) {
        const callback = new URL(
          `/social/${provider.toLowerCase()}/callback`,
          options.config.issuer,
        );
        callback.searchParams.set("state", transaction);
        callback.searchParams.set("subject", "google-mock-user");
        callback.searchParams.set("email", "google.mock@example.test");
        callback.searchParams.set("name", "Google Mock");
        callback.searchParams.set("email_verified", "true");
        return reply.redirect(callback.href);
      }
      const target = new URL(connector.authorizationEndpoint);
      target.search = new URLSearchParams({
        response_type: "code",
        client_id: connector.clientId,
        redirect_uri: new URL(
          `/social/${provider.toLowerCase()}/callback`,
          options.config.issuer,
        ).href,
        scope: connector.scopes.join(" "),
        state: transaction,
      }).toString();
      return reply.redirect(target.href);
    },
  );

  app.get<{ Params: { provider: string } }>(
    "/social/:provider/callback",
    async (request, reply) => {
      if (!options) return reply.code(503).send({ error: "not_configured" });
      const query = request.query as {
        state?: string;
        code?: string;
        subject?: string;
        email?: string;
        name?: string;
        email_verified?: string;
      };
      const provider = request.params.provider.toUpperCase();
      if (!query.state)
        return reply.code(400).send({ error: "invalid_social_callback" });
      let profile;
      if (options.config.socialMockEnabled) {
        if (!query.subject)
          return reply.code(400).send({ error: "invalid_social_callback" });
        profile = {
          subject: query.subject,
          ...(query.email ? { email: query.email } : {}),
          ...(query.name ? { name: query.name } : {}),
          emailVerified: query.email_verified === "true",
        };
      } else {
        if (!query.code)
          return reply.code(400).send({ error: "invalid_social_callback" });
        const connector = resolveConnectors(
          await options.repository.listEnabledConnectors(),
          process.env,
        ).find((item) => item.provider === provider);
        if (!connector)
          return reply.code(404).send({ error: "connector_unavailable" });
        try {
          profile = await exchangeSocialCode(
            connector,
            query.code,
            new URL(
              `/social/${provider.toLowerCase()}/callback`,
              options.config.issuer,
            ).href,
          );
        } catch {
          return reply.code(401).send({ error: "social_auth_failed" });
        }
      }
      let credential = await options.repository.findIdentity(
        provider,
        profile.subject,
      );
      if (!credential) {
        const decision = socialSignupDecision(
          profile,
          profile.email &&
            (await options.repository.findCredentialByEmail(profile.email))
            ? "existing"
            : undefined,
        );
        if (decision === "LINK_REQUIRED")
          return reply.code(409).send({ error: "authenticated_link_required" });
        if (decision === "COMPLETE_PROFILE")
          return reply
            .code(422)
            .send({ error: "profile_completion_required", expires_in: 600 });
        await options.repository.registerSocial({
          provider,
          subject: profile.subject,
          email: profile.email!,
          name: profile.name!,
          emailVerified: profile.emailVerified === true,
        });
        credential = await options.repository.findIdentity(
          provider,
          profile.subject,
        );
      }
      if (!credential)
        return reply.code(400).send({ error: "social_auth_failed" });
      const now = new Date();
      const sessionToken = randomOpaqueToken();
      const session = await options.repository.createSession({
        userId: credential.userId,
        tokenHash: digestToken(sessionToken),
        idleExpiresAt: new Date(now.getTime() + 1_800_000),
        expiresAt: new Date(now.getTime() + 43_200_000),
      });
      const code = randomOpaqueToken();
      const complete = await options.repository.completeAuthorization({
        handleHash: digestToken(query.state),
        codeHash: digestToken(code),
        userId: credential.userId,
        sessionId: session.id,
        now,
        expiresAt: new Date(now.getTime() + 60_000),
      });
      if (!complete)
        return reply.code(400).send({ error: "invalid_transaction" });
      const target = new URL(complete.redirectUri);
      target.searchParams.set("code", code);
      if (complete.state) target.searchParams.set("state", complete.state);
      reply.setCookie("pa_sso", sessionToken, {
        httpOnly: true,
        secure: options.config.cookieSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 43_200,
      });
      return reply.redirect(target.href);
    },
  );

  app.post("/logout", async (request, reply) => {
    if (options) {
      const raw = request.cookies.pa_sso;
      const session = raw
        ? await options.repository.getSession(digestToken(raw), new Date())
        : null;
      if (session)
        await options.repository.revokeAllSessions(session.userId, new Date());
      else if (request.headers.authorization?.startsWith("Bearer ")) {
        try {
          const claims = await options.tokens.verify(
            request.headers.authorization.slice(7),
          );
          if (typeof claims.sid === "string")
            await options.repository.revokeSession(claims.sid, new Date());
        } catch {
          // Logout is intentionally idempotent for invalid or expired tokens.
        }
      }
    }
    reply.clearCookie("pa_sso", { path: "/" });
    return reply.code(204).send();
  });
  return app;
}

async function issueTokens(
  options: AuthAppOptions,
  session: SessionContext,
  clientId: string,
  scopes: string[],
  nonce: string | null,
  suppliedRefresh?: string,
) {
  const claims: AccessClaims = {
    sub: session.userId,
    sid: session.id,
    roles: session.roles,
    seller_ids: session.sellerIds,
    email: session.email,
    email_verified: session.emailVerified,
    scope: scopes.join(" "),
  };
  const accessToken = await options.tokens.signAccess(claims, clientId);
  const idToken = await options.tokens.signId(claims, clientId, nonce);
  let refreshToken = suppliedRefresh;
  if (!refreshToken && scopes.includes("offline_access")) {
    refreshToken = randomOpaqueToken();
    await options.repository.createRefreshToken({
      userId: session.userId,
      sessionId: session.id,
      clientId,
      tokenHash: digestToken(refreshToken),
      familyId: crypto.randomUUID(),
      scopes,
      expiresAt: new Date(Date.now() + 2_592_000_000),
    });
  }
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 300,
    id_token: idToken,
    scope: scopes.join(" "),
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  };
}
