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
  "semeia referências brasileiras sem ativar outros mercados",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const summary = await applyMarketplaceSeed(pool);
      assert.deepEqual(summary, {
        currencies: 1,
        markets: 1,
        machineTypes: 8,
        brands: 23,
        partCategories: 10,
      });
      const market = await pool.query(
        "select code,default_currency,default_locale,timezone,active from marketplace.market",
      );
      assert.deepEqual(market.rows, [
        {
          code: "BR",
          default_currency: "BRL",
          default_locale: "pt-BR",
          timezone: "America/Sao_Paulo",
          active: true,
        },
      ]);
      const brand = await pool.query(
        "select name from marketplace.brand where slug = 'john-deere'",
      );
      assert.equal(brand.rows[0].name, "John Deere");
      const category = await pool.query(
        "select name from marketplace.part_category where slug = 'hidraulica'",
      );
      assert.equal(category.rows[0].name, "Hidráulica");
      const compatibility = await pool.query(
        "select value from public.app_setting where key = 'brand_name'",
      );
      assert.equal(compatibility.rows[0].value, "PARTSAGRICOLA");
    });
  },
);

test(
  "reaplica seeds preservando IDs e contagens",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      await applyMarketplaceSeed(pool);
      const before = await pool.query(
        "select id,slug from marketplace.brand order by slug",
      );
      const firstSummary = await applyMarketplaceSeed(pool);
      const after = await pool.query(
        "select id,slug from marketplace.brand order by slug",
      );
      const secondSummary = await applyMarketplaceSeed(pool);

      assert.deepEqual(after.rows, before.rows);
      assert.deepEqual(secondSummary, firstSummary);
    });
  },
);
