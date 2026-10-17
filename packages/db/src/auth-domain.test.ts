import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { applyMigrations } from "./migrations.js";
import { applyMarketplaceSeed } from "./seed.js";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;

async function withDatabase(
  run: (pool: pg.Pool) => Promise<void>,
): Promise<void> {
  assert.ok(adminUrl, "MARKETPLACE_TEST_ADMIN_URL is required");
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const database = `partsagricola_test_${crypto.randomUUID().replaceAll("-", "")}`;
  assert.match(database, /^partsagricola_test_[a-f0-9]{32}$/);
  await admin.query(`CREATE DATABASE ${database}`);
  const target = new URL(adminUrl);
  target.pathname = `/${database}`;
  const pool = new pg.Pool({ connectionString: target.toString() });
  try {
    await applyMigrations(pool, new URL("../sql/", import.meta.url));
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
}

test(
  "cria o domínio persistente de autenticação sem armazenar segredo social",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const tables = await pool.query<{ table_name: string }>(`
        select table_name
          from information_schema.tables
         where table_schema = 'marketplace'
           and table_name like 'auth_%'
         order by table_name
      `);
      assert.deepEqual(
        tables.rows.map((row) => row.table_name),
        [
          "auth_authorization_code",
          "auth_client",
          "auth_client_redirect",
          "auth_connector",
          "auth_credential",
          "auth_identity",
          "auth_login_attempt",
          "auth_one_time_token",
          "auth_refresh_token",
          "auth_role",
          "auth_session",
          "auth_social_signup",
          "auth_transaction",
          "auth_user_role",
        ],
      );

      const forbidden = await pool.query<{ column_name: string }>(`
        select column_name
          from information_schema.columns
         where table_schema = 'marketplace'
           and table_name = 'auth_connector'
           and column_name = any(array['client_secret','client_secret_value','private_key','credentials'])
      `);
      assert.deepEqual(forbidden.rows, []);
    });
  },
);

test(
  "impõe unicidade de CPF, identidade social e tokens de uso único",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      await applyMarketplaceSeed(pool);
      const users = await pool.query<{ id: string }>(`
        insert into marketplace.app_user (email,name) values
          ('one@example.test','One'),
          ('two@example.test','Two')
        returning id
      `);
      const digest = Buffer.alloc(32, 7);
      await pool.query(
        "insert into marketplace.auth_credential (user_id,password_hash,cpf_digest) values ($1,'$argon2id$test',$2)",
        [users.rows[0]!.id, digest],
      );
      await assert.rejects(
        pool.query(
          "insert into marketplace.auth_credential (user_id,password_hash,cpf_digest) values ($1,'$argon2id$other',$2)",
          [users.rows[1]!.id, digest],
        ),
        (error: Error & { code?: string }) => error.code === "23505",
      );

      await pool.query(
        "insert into marketplace.auth_identity (user_id,provider,subject,email,email_verified) values ($1,'GOOGLE','subject-1','one@example.test',true)",
        [users.rows[0]!.id],
      );
      await assert.rejects(
        pool.query(
          "insert into marketplace.auth_identity (user_id,provider,subject,email,email_verified) values ($1,'GOOGLE','subject-1','two@example.test',true)",
          [users.rows[1]!.id],
        ),
        (error: Error & { code?: string }) => error.code === "23505",
      );

      const tokenHash = Buffer.alloc(32, 9);
      await pool.query(
        "insert into marketplace.auth_one_time_token (user_id,kind,token_hash,expires_at) values ($1,'EMAIL_VERIFY',$2,now()+interval '1 hour')",
        [users.rows[0]!.id, tokenHash],
      );
      await assert.rejects(
        pool.query(
          "insert into marketplace.auth_one_time_token (user_id,kind,token_hash,expires_at) values ($1,'PASSWORD_RESET',$2,now()+interval '1 hour')",
          [users.rows[1]!.id, tokenHash],
        ),
        (error: Error & { code?: string }) => error.code === "23505",
      );
    });
  },
);

test(
  "semeia papéis, conectores e clientes com redirects em allowlist",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const existing = await pool.query<{ id: string }>(
        "insert into marketplace.app_user (email,name) values ('legacy@example.test','Legacy') returning id",
      );
      await applyMarketplaceSeed(pool);
      await applyMarketplaceSeed(pool);

      const roles = await pool.query<{ key: string }>(
        "select key from marketplace.auth_role order by key",
      );
      assert.deepEqual(
        roles.rows.map((row) => row.key),
        ["ADMIN", "FINANCE", "SUPPORT", "USER"],
      );
      const connectors = await pool.query<{
        provider: string;
        enabled: boolean;
      }>(
        "select provider,enabled from marketplace.auth_connector order by provider",
      );
      assert.deepEqual(connectors.rows, [
        { provider: "APPLE", enabled: false },
        { provider: "FACEBOOK", enabled: false },
        { provider: "GOOGLE", enabled: false },
        { provider: "MICROSOFT", enabled: false },
      ]);
      const redirects = await pool.query<{
        client_id: string;
        redirect_uri: string;
      }>(
        "select client_id,redirect_uri from marketplace.auth_client_redirect where kind='LOGIN' order by client_id,redirect_uri",
      );
      assert.deepEqual(redirects.rows, [
        {
          client_id: "partsagricola-admin",
          redirect_uri: "http://127.0.0.1:3002/auth/callback",
        },
        {
          client_id: "partsagricola-mobile",
          redirect_uri: "br.com.partsagricola.app:/oauth/callback",
        },
        {
          client_id: "partsagricola-seller",
          redirect_uri: "http://127.0.0.1:3001/auth/callback",
        },
        {
          client_id: "partsagricola-web",
          redirect_uri: "http://127.0.0.1:3000/auth/callback",
        },
      ]);
      await assert.rejects(
        pool.query(
          "insert into marketplace.auth_client_redirect (client_id,redirect_uri) values ('unknown','https://attacker.test/callback')",
        ),
        (error: Error & { code?: string }) => error.code === "23503",
      );
      await pool.query(
        `insert into marketplace.auth_transaction
           (handle_hash,client_id,redirect_uri,code_challenge,scopes,expires_at)
         values ($1,'partsagricola-web','http://127.0.0.1:3000/auth/callback',$2,array['openid'],now()+interval '10 minutes')`,
        [Buffer.alloc(32, 3), "A".repeat(43)],
      );
      await assert.rejects(
        pool.query(
          `insert into marketplace.auth_transaction
             (handle_hash,client_id,redirect_uri,code_challenge,scopes,expires_at)
           values ($1,'partsagricola-web','https://attacker.test/callback',$2,array['openid'],now()+interval '10 minutes')`,
          [Buffer.alloc(32, 4), "B".repeat(43)],
        ),
        (error: Error & { code?: string }) => error.code === "23503",
      );
      const preserved = await pool.query(
        "select email from marketplace.app_user where id=$1",
        [existing.rows[0]!.id],
      );
      assert.equal(preserved.rows[0].email, "legacy@example.test");
    });
  },
);
