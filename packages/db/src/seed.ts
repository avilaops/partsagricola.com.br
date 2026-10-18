import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type pg from "pg";

import { createPool } from "./index.js";

export interface SeedSummary {
  currencies: number;
  markets: number;
  machineTypes: number;
  brands: number;
  partCategories: number;
  authRoles: number;
  authConnectors: number;
  authClients: number;
}

export async function applyMarketplaceSeed(
  pool: pg.Pool,
  file = new URL("../sql/seed_marketplace.sql", import.meta.url),
): Promise<SeedSummary> {
  const sql = await readFile(file, "utf8");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    const counts = await client.query<SeedSummary>(`
      select
        (select count(*)::integer from marketplace.currency) as currencies,
        (select count(*)::integer from marketplace.market) as markets,
        (select count(*)::integer from marketplace.machine_type) as "machineTypes",
        (select count(*)::integer from marketplace.brand) as brands,
        (select count(*)::integer from marketplace.part_category) as "partCategories",
        (select count(*)::integer from marketplace.auth_role) as "authRoles",
        (select count(*)::integer from marketplace.auth_connector) as "authConnectors",
        (select count(*)::integer from marketplace.auth_client) as "authClients"
    `);
    await client.query("commit");
    return counts.rows[0]!;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (entrypoint) {
  const pool = createPool();
  try {
    const summary = await applyMarketplaceSeed(pool);
    console.log(`seed applied ${JSON.stringify(summary)}`);
  } finally {
    await pool.end();
  }
}
