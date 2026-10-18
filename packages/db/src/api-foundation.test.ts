import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { applyMigrations } from "./migrations.js";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;

test(
  "migration da API cria fila recuperável e amplia auditoria",
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
      const columns = await pool.query<{ column_name: string }>(`
      select column_name from information_schema.columns
       where table_schema='marketplace' and table_name='audit_log'
         and column_name in ('market_id','ip_address','diff') order by column_name
    `);
      assert.deepEqual(
        columns.rows.map((row) => row.column_name),
        ["diff", "ip_address", "market_id"],
      );
      assert.equal(
        (
          await pool.query(
            "select to_regclass('marketplace.image_job') as name",
          )
        ).rows[0].name,
        "marketplace.image_job",
      );
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
    }
  },
);
