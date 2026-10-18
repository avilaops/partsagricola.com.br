import assert from "node:assert/strict";
import test from "node:test";
import { MemoryMailTransport } from "./mailer.ts";
import {
  exchangeSocialCode,
  socialSignupDecision,
  resolveConnectors,
} from "./social.ts";
test("mailer em memória não envia externamente", async () => {
  const mail = new MemoryMailTransport();
  await mail.send({ to: "a@test", subject: "s", text: "t" });
  assert.equal(mail.messages.length, 1);
});
test("connector ativo falha fechado sem segredo e nunca serializa segredo no registro", () => {
  const records = [
    {
      provider: "GOOGLE",
      clientIdEnv: "GOOGLE_ID",
      clientSecretEnv: "GOOGLE_SECRET",
      authorizationEndpoint: "https://google/authorize",
      tokenEndpoint: "https://google/token",
      userinfoEndpoint: "https://google/user",
      scopes: ["openid"],
    },
  ];
  assert.deepEqual(resolveConnectors(records, { GOOGLE_ID: "id" }), []);
  const resolved = resolveConnectors(records, {
    GOOGLE_ID: "id",
    GOOGLE_SECRET: "secret",
  });
  assert.equal(resolved.length, 1);
  assert.equal(JSON.stringify(records).includes('"secret"'), false);
});
test("social nunca auto-vincula email existente e limita cadastro a complementação", () => {
  assert.equal(
    socialSignupDecision(
      { subject: "1", email: "old@test", emailVerified: true, name: "Old" },
      "existing",
    ),
    "LINK_REQUIRED",
  );
  assert.equal(socialSignupDecision({ subject: "2" }), "COMPLETE_PROFILE");
  assert.equal(
    socialSignupDecision({
      subject: "3",
      email: "new@test",
      emailVerified: true,
      name: "New",
    }),
    "CREATE",
  );
});
test("conector troca code no backend e normaliza perfil sem expor access token", async () => {
  const calls: string[] = [];
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return url.endsWith("/token")
      ? new Response(JSON.stringify({ access_token: "provider-secret" }), {
          status: 200,
        })
      : new Response(
          JSON.stringify({
            sub: "social-1",
            email: "social@test",
            email_verified: true,
            name: "Social",
          }),
          { status: 200 },
        );
  };
  const profile = await exchangeSocialCode(
    {
      provider: "GOOGLE",
      clientId: "id",
      clientSecret: "secret",
      authorizationEndpoint: "https://provider/authorize",
      tokenEndpoint: "https://provider/token",
      userinfoEndpoint: "https://provider/userinfo",
      scopes: ["openid"],
    },
    "code",
    "https://auth/callback",
    fetcher as typeof fetch,
  );
  assert.deepEqual(profile, {
    subject: "social-1",
    email: "social@test",
    emailVerified: true,
    name: "Social",
  });
  assert.deepEqual(calls, [
    "https://provider/token",
    "https://provider/userinfo",
  ]);
  assert.equal(JSON.stringify(profile).includes("provider-secret"), false);
});
