import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { applyMigrations } from "./migrations.js";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;

test("migration modela chat moderado, quarentena, revisão e sanções", async () => {
  const sql = await readFile(
    new URL("../sql/006_chat_moderation.sql", import.meta.url),
    "utf8",
  );
  for (const fragment of [
    "conversation_context_type_check",
    "message_attachment",
    "moderation_flag",
    "moderation_job",
    "moderation_evidence",
    "content_report",
    "moderation_policy",
    "moderation_sanction",
    "purge_expired_moderation_evidence",
  ]) {
    assert.match(sql, new RegExp(fragment));
  }
});

test(
  "banco impõe contexto único, quarentena e denúncia idempotente",
  { skip: !adminUrl },
  async () => {
    assert.ok(adminUrl);
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    const database = `partsagricola_test_${crypto.randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const target = new URL(adminUrl);
    target.pathname = `/${database}`;
    const pool = new pg.Pool({ connectionString: target.toString() });
    try {
      await applyMigrations(pool, new URL("../sql/", import.meta.url));
      const tables = await pool.query<{ table_name: string }>(`
        select table_name from information_schema.tables
        where table_schema='marketplace' and table_name in
          ('message_attachment','moderation_flag','moderation_job','moderation_evidence',
           'content_report','moderation_policy','moderation_sanction')
        order by table_name
      `);
      assert.deepEqual(
        tables.rows.map((row) => row.table_name),
        [
          "content_report",
          "message_attachment",
          "moderation_evidence",
          "moderation_flag",
          "moderation_job",
          "moderation_policy",
          "moderation_sanction",
        ],
      );
      const messageColumns = await pool.query<{ column_name: string }>(`
        select column_name from information_schema.columns
        where table_schema='marketplace' and table_name='message'
          and column_name in ('moderation_status','safe_body','client_message_id')
        order by column_name
      `);
      assert.deepEqual(
        messageColumns.rows.map((row) => row.column_name),
        ["client_message_id", "moderation_status", "safe_body"],
      );
      const attachmentDefault = await pool.query<{ column_default: string }>(`
        select column_default from information_schema.columns
        where table_schema='marketplace' and table_name='message_attachment'
          and column_name='status'
      `);
      assert.match(attachmentDefault.rows[0]!.column_default, /QUARANTINED/);
      await pool.query(
        "insert into marketplace.currency (code,name,symbol) values ('BRL','Real','R$')",
      );
      const market = await pool.query<{ id: string }>(
        `insert into marketplace.market
          (code,name,default_currency,default_locale,timezone,active)
         values ('BR','Brasil','BRL','pt-BR','America/Sao_Paulo',true) returning id`,
      );
      const contexts = await pool.query<{ context_type: string }>(
        `insert into marketplace.conversation (market_id,context_type,context_id)
         values ($1,'PROPOSAL',gen_random_uuid()),($1,'ORDER',gen_random_uuid())
         returning context_type`,
        [market.rows[0]!.id],
      );
      assert.deepEqual(contexts.rows.map((row) => row.context_type).sort(), [
        "ORDER",
        "PROPOSAL",
      ]);
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
    }
  },
);
