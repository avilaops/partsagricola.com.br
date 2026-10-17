import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

import type pg from "pg";

export interface Migration {
  version: string;
  name: string;
  checksum: string;
  sql: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

const MIGRATION_FILE = /^(\d{3})_([a-z0-9][a-z0-9_-]*)\.sql$/;

export async function discoverMigrations(directory: URL): Promise<Migration[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const migrations: Migration[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = MIGRATION_FILE.exec(entry.name);
    if (!match) continue;

    const version = match[1]!;
    const name = match[2]!;
    const sql = await readFile(new URL(entry.name, directory), "utf8");
    migrations.push({
      version,
      name,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }

  migrations.sort((left, right) => left.version.localeCompare(right.version));
  for (let index = 1; index < migrations.length; index += 1) {
    const previous = migrations[index - 1]!;
    const current = migrations[index]!;
    if (previous.version === current.version) {
      throw new Error(`DUPLICATE_MIGRATION_VERSION: ${current.version}`);
    }
  }

  return migrations;
}

export async function applyMigrations(
  pool: pg.Pool,
  directory: URL,
): Promise<MigrationResult> {
  const migrations = await discoverMigrations(directory);
  const client = await pool.connect();
  const result: MigrationResult = { applied: [], skipped: [] };

  try {
    await client.query(
      "select pg_advisory_lock(hashtext('partsagricola:schema_migrations'))",
    );
    await client.query(`
      create table if not exists public.schema_migration (
        version text primary key,
        name text not null,
        checksum char(64) not null,
        applied_at timestamptz not null default now()
      )
    `);

    for (const migration of migrations) {
      const existing = await client.query<{ checksum: string }>(
        "select checksum from public.schema_migration where version = $1",
        [migration.version],
      );
      if (existing.rowCount) {
        if (existing.rows[0]!.checksum !== migration.checksum) {
          throw new Error(`MIGRATION_CHECKSUM_MISMATCH: ${migration.version}`);
        }
        result.skipped.push(migration.version);
        continue;
      }

      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query(
          `insert into public.schema_migration (version, name, checksum)
           values ($1, $2, $3)`,
          [migration.version, migration.name, migration.checksum],
        );
        await client.query("commit");
        result.applied.push(migration.version);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    return result;
  } finally {
    await client
      .query(
        "select pg_advisory_unlock(hashtext('partsagricola:schema_migrations'))",
      )
      .catch(() => undefined);
    client.release();
  }
}
