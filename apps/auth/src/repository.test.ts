import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { applyMigrations } from "../../../packages/db/src/migrations.ts";
import { applyMarketplaceSeed } from "../../../packages/db/src/seed.ts";
import { digestCpf, digestToken } from "./crypto.ts";
import { AuthRepository } from "./repository.ts";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;
const lookupKey = Buffer.alloc(32, 22);

async function withRepository(
  run: (repository: AuthRepository, pool: pg.Pool) => Promise<void>,
): Promise<void> {
  assert.ok(adminUrl, "MARKETPLACE_TEST_ADMIN_URL is required");
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const database = `partsagricola_test_${crypto.randomUUID().replaceAll("-", "")}`;
  assert.match(database, /^partsagricola_test_[a-f0-9]{32}$/);
  await admin.query(`CREATE DATABASE ${database}`);
  const target = new URL(adminUrl);
  target.pathname = `/${database}`;
  const pool = new pg.Pool({ connectionString: target.toString(), max: 8 });
  try {
    await applyMigrations(
      pool,
      new URL("../../../packages/db/sql/", import.meta.url),
    );
    await applyMarketplaceSeed(pool);
    await run(new AuthRepository(pool), pool);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
}

test(
  "cadastro local encontra a mesma conta por e-mail normalizado ou CPF",
  { skip: !adminUrl },
  async () => {
    await withRepository(async (repository) => {
      const cpfDigest = digestCpf("123.456.789-09", lookupKey);
      const user = await repository.registerLocal({
        email: "  Buyer@Example.Test ",
        name: "Buyer",
        passwordHash: "$argon2id$registered",
        cpfDigest,
      });

      const byEmail =
        await repository.findCredentialByEmail("buyer@example.test");
      const byCpf = await repository.findCredentialByCpf(cpfDigest);
      assert.equal(byEmail?.userId, user.id);
      assert.equal(byCpf?.userId, user.id);
      assert.equal(byEmail?.email, "buyer@example.test");
      assert.deepEqual(byEmail?.roles, ["USER"]);
    });
  },
);

test(
  "verificação e reset são de uso único e reset revoga sessões",
  { skip: !adminUrl },
  async () => {
    await withRepository(async (repository) => {
      const user = await repository.registerLocal({
        email: "reset@example.test",
        name: "Reset",
        passwordHash: "$argon2id$before",
      });
      const now = new Date("2026-10-17T12:00:00.000Z");
      const verifyHash = digestToken("verify-once");
      await repository.createOneTimeToken({
        userId: user.id,
        kind: "EMAIL_VERIFY",
        tokenHash: verifyHash,
        expiresAt: new Date(now.getTime() + 60_000),
      });
      assert.equal(await repository.verifyEmail(verifyHash, now), user.id);
      assert.equal(await repository.verifyEmail(verifyHash, now), null);

      const sessionHash = digestToken("session-before-reset");
      await repository.createSession({
        userId: user.id,
        tokenHash: sessionHash,
        idleExpiresAt: new Date(now.getTime() + 30_000),
        expiresAt: new Date(now.getTime() + 60_000),
      });
      const resetHash = digestToken("reset-once");
      await repository.createOneTimeToken({
        userId: user.id,
        kind: "PASSWORD_RESET",
        tokenHash: resetHash,
        expiresAt: new Date(now.getTime() + 60_000),
      });
      assert.equal(
        await repository.resetPassword(resetHash, "$argon2id$after", now),
        user.id,
      );
      assert.equal(
        await repository.resetPassword(resetHash, "$argon2id$again", now),
        null,
      );
      assert.equal(await repository.getSession(sessionHash, now), null);
    });
  },
);

test(
  "sessão retorna papéis e somente empresas com membership ativo",
  { skip: !adminUrl },
  async () => {
    await withRepository(async (repository, pool) => {
      const user = await repository.registerLocal({
        email: "member@example.test",
        name: "Member",
        passwordHash: "$argon2id$member",
      });
      const market = await pool.query<{ id: string }>(
        "select id from marketplace.market where code='BR'",
      );
      const companies = await pool.query<{ id: string }>(
        `insert into marketplace.company
          (market_id,cnpj,legal_name,trade_name,slug,email,state_code,city,status,approved_at)
         values
          ($1,'12345678000190','Ativa LTDA','Ativa','ativa-auth','ativa@example.test','SP','Franca','APPROVED',now()),
          ($1,'98765432000110','Inativa LTDA','Inativa','inativa-auth','inativa@example.test','PR','Londrina','APPROVED',now())
         returning id`,
        [market.rows[0]!.id],
      );
      await pool.query(
        `insert into marketplace.company_member (company_id,user_id,role,active)
         values ($1,$3,'OWNER',true),($2,$3,'VIEWER',false)`,
        [companies.rows[0]!.id, companies.rows[1]!.id, user.id],
      );
      await pool.query(
        "insert into marketplace.auth_user_role (user_id,role_key) values ($1,'SUPPORT')",
        [user.id],
      );
      const now = new Date("2026-10-17T12:00:00.000Z");
      const tokenHash = digestToken("active-session");
      await repository.createSession({
        userId: user.id,
        tokenHash,
        idleExpiresAt: new Date(now.getTime() + 60_000),
        expiresAt: new Date(now.getTime() + 120_000),
      });
      const context = await repository.getSession(tokenHash, now);
      assert.deepEqual(context?.roles, ["SUPPORT", "USER"]);
      assert.deepEqual(context?.sellerIds, [companies.rows[0]!.id]);
    });
  },
);

test(
  "sessão expirada ou revogada nunca é retornada",
  { skip: !adminUrl },
  async () => {
    await withRepository(async (repository) => {
      const user = await repository.registerLocal({
        email: "expiry@example.test",
        name: "Expiry",
        passwordHash: "$argon2id$expiry",
      });
      const now = new Date("2026-10-17T12:00:00.000Z");
      const expired = digestToken("expired-session");
      await repository.createSession({
        userId: user.id,
        tokenHash: expired,
        idleExpiresAt: new Date(now.getTime() - 2_000),
        expiresAt: new Date(now.getTime() - 1_000),
      });
      assert.equal(await repository.getSession(expired, now), null);

      const active = digestToken("revoked-session");
      await repository.createSession({
        userId: user.id,
        tokenHash: active,
        idleExpiresAt: new Date(now.getTime() + 60_000),
        expiresAt: new Date(now.getTime() + 120_000),
      });
      await repository.revokeAllSessions(user.id, now);
      assert.equal(await repository.getSession(active, now), null);
    });
  },
);

test(
  "replay concorrente de refresh revoga toda a família",
  { skip: !adminUrl },
  async () => {
    await withRepository(async (repository) => {
      const user = await repository.registerLocal({
        email: "refresh@example.test",
        name: "Refresh",
        passwordHash: "$argon2id$refresh",
      });
      const now = new Date("2026-10-17T12:00:00.000Z");
      const sessionHash = digestToken("refresh-session");
      const session = await repository.createSession({
        userId: user.id,
        tokenHash: sessionHash,
        idleExpiresAt: new Date(now.getTime() + 60_000),
        expiresAt: new Date(now.getTime() + 120_000),
      });
      const familyId = crypto.randomUUID();
      const originalHash = digestToken("refresh-original");
      await repository.createRefreshToken({
        userId: user.id,
        sessionId: session.id,
        clientId: "partsagricola-web",
        tokenHash: originalHash,
        familyId,
        scopes: ["openid", "offline_access"],
        expiresAt: new Date(now.getTime() + 600_000),
      });

      const results = await Promise.all([
        repository.rotateRefreshToken({
          currentHash: originalHash,
          replacementHash: digestToken("replacement-one"),
          now,
          expiresAt: new Date(now.getTime() + 600_000),
        }),
        repository.rotateRefreshToken({
          currentHash: originalHash,
          replacementHash: digestToken("replacement-two"),
          now,
          expiresAt: new Date(now.getTime() + 600_000),
        }),
      ]);
      assert.deepEqual(results.map((result) => result.status).sort(), [
        "replay",
        "rotated",
      ]);
      assert.equal(
        await repository.isRefreshFamilyActive(familyId, now),
        false,
      );
    });
  },
);

test(
  "rate limit de login persiste após cinco falhas por identidade e IP",
  { skip: !adminUrl },
  async () => {
    await withRepository(async (repository) => {
      const identifier = digestToken("rate@example.test");
      const ip = digestToken("127.0.0.1");
      const now = new Date("2026-10-17T12:00:00.000Z");
      assert.equal(
        await repository.isLoginRateLimited(identifier, ip, now),
        false,
      );
      for (let attempt = 0; attempt < 5; attempt += 1)
        await repository.recordLoginAttempt(identifier, ip, false, now);
      assert.equal(
        await repository.isLoginRateLimited(identifier, ip, now),
        true,
      );
      assert.equal(
        await repository.isLoginRateLimited(
          identifier,
          digestToken("127.0.0.2"),
          now,
        ),
        false,
      );
    });
  },
);
