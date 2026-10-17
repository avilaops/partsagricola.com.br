import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import pg from "pg";

import { applyMigrations, discoverMigrations } from "./migrations.js";

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
  const pool = new pg.Pool({ connectionString: target.toString(), max: 5 });
  try {
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
}

async function migrationDirectory(files: Record<string, string>) {
  const directory = join(
    tmpdir(),
    `partsagricola-migrations-${crypto.randomUUID()}`,
  );
  await mkdir(directory, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([name, sql]) =>
      writeFile(join(directory, name), sql, "utf8"),
    ),
  );
  return pathToFileURL(`${directory}/`);
}

test("descobre somente migrations numeradas em ordem crescente", async () => {
  const directory = await migrationDirectory({
    "010_last.sql": "select 10;\n",
    "002_second.sql": "select 2;\n",
    "001_first.sql": "select 1;\n",
    "seed_marketplace.sql": "select 'seed';\n",
    "notes.md": "not sql",
  });

  const migrations = await discoverMigrations(directory);

  assert.deepEqual(
    migrations.map(({ version, name }) => ({ version, name })),
    [
      { version: "001", name: "first" },
      { version: "002", name: "second" },
      { version: "010", name: "last" },
    ],
  );
});

test("checksum SHA-256 muda somente quando o SQL muda", async () => {
  const firstDirectory = await migrationDirectory({
    "001_first.sql": "select 1;\n",
  });
  const sameDirectory = await migrationDirectory({
    "001_first.sql": "select 1;\n",
  });
  const changedDirectory = await migrationDirectory({
    "001_first.sql": "select 2;\n",
  });

  const [first] = await discoverMigrations(firstDirectory);
  const [same] = await discoverMigrations(sameDirectory);
  const [changed] = await discoverMigrations(changedDirectory);
  assert.ok(first);
  assert.ok(same);
  assert.ok(changed);

  assert.match(first.checksum, /^[a-f0-9]{64}$/);
  assert.equal(first.checksum, same.checksum);
  assert.notEqual(first.checksum, changed.checksum);
});

test("rejeita duas migrations com a mesma versão", async () => {
  const directory = await migrationDirectory({
    "001_first.sql": "select 1;\n",
    "001_duplicate.sql": "select 2;\n",
  });

  await assert.rejects(
    discoverMigrations(directory),
    /DUPLICATE_MIGRATION_VERSION: 001/,
  );
});

test(
  "aplica migrations uma vez e preserva o histórico na reaplicação",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const directory = await migrationDirectory({
        "001_first.sql": "create table example (id integer primary key);\n",
        "002_second.sql": "alter table example add column name text;\n",
      });

      assert.deepEqual(await applyMigrations(pool, directory), {
        applied: ["001", "002"],
        skipped: [],
      });
      assert.deepEqual(await applyMigrations(pool, directory), {
        applied: [],
        skipped: ["001", "002"],
      });
      const history = await pool.query(
        "select version, name from public.schema_migration order by version",
      );
      assert.deepEqual(history.rows, [
        { version: "001", name: "first" },
        { version: "002", name: "second" },
      ]);
    });
  },
);

test(
  "rejeita checksum diferente para migration já aplicada",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const original = await migrationDirectory({
        "001_first.sql": "create table example (id integer primary key);\n",
      });
      const changed = await migrationDirectory({
        "001_first.sql": "create table example (id bigint primary key);\n",
      });

      await applyMigrations(pool, original);

      await assert.rejects(
        applyMigrations(pool, changed),
        /MIGRATION_CHECKSUM_MISMATCH: 001/,
      );
    });
  },
);

test(
  "serializa dois migradores concorrentes",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const directory = await migrationDirectory({
        "001_first.sql": "create table example (id integer primary key);\n",
      });

      const results = await Promise.all([
        applyMigrations(pool, directory),
        applyMigrations(pool, directory),
      ]);

      assert.equal(results.flatMap((result) => result.applied).length, 1);
      assert.equal(results.flatMap((result) => result.skipped).length, 1);
    });
  },
);

test(
  "reverte por completo a migration que falha",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const directory = await migrationDirectory({
        "001_broken.sql":
          "create table should_rollback (id integer); select missing_column from should_rollback;\n",
      });

      await assert.rejects(applyMigrations(pool, directory), /missing_column/);
      const relation = await pool.query(
        "select to_regclass('public.should_rollback') as relation",
      );
      assert.equal(relation.rows[0].relation, null);
      const history = await pool.query(
        "select count(*)::integer as count from public.schema_migration",
      );
      assert.equal(history.rows[0].count, 0);
    });
  },
);
