import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import {
  importCatalog,
  parseCatalogCsv,
  resolveCatalogPath,
  type CatalogImportRow,
} from "./catalog-import.js";
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
    await applyMarketplaceSeed(pool);
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
}

const header =
  "schema_version,source,external_id,part_name,part_code,code_type,brand,category,description,machine_type,machine_brand,machine_model,year_start,year_end";

test("resolve o arquivo explícito mesmo quando pnpm preserva o separador", () => {
  assert.equal(
    resolveCatalogPath(["--", "fixtures/catalog.csv"]),
    "fixtures/catalog.csv",
  );
  assert.equal(
    resolveCatalogPath(["fixtures/catalog.csv"]),
    "fixtures/catalog.csv",
  );
  assert.throws(() => resolveCatalogPath(["--"]), /CATALOG_CSV_PATH_REQUIRED/);
});

test("interpreta CSV UTF-8, campos entre aspas e opcionais vazios", () => {
  const rows = parseCatalogCsv(
    `${header}\n1,geomaq,G-1,"Bomba, hidráulica",BH-01,ORIGINAL,John Deere,Hidráulica,"Aplicação agrícola, alta pressão",Trator,John Deere,6110J,2015,2020\n`,
  );

  assert.deepEqual(rows, [
    {
      schemaVersion: 1,
      source: "geomaq",
      externalId: "G-1",
      partName: "Bomba, hidráulica",
      partCode: "BH-01",
      codeType: "ORIGINAL",
      brand: "John Deere",
      category: "Hidráulica",
      description: "Aplicação agrícola, alta pressão",
      machineType: "Trator",
      machineBrand: "John Deere",
      machineModel: "6110J",
      yearStart: 2015,
      yearEnd: 2020,
    },
  ]);

  const optional = parseCatalogCsv(
    `${header}\n1,imdepa,I-1,Retentor,R-10,EQUIVALENT,,,Vedação,,,,,\n`,
  );
  assert.equal(optional[0]!.brand, null);
  assert.equal(optional[0]!.yearStart, null);
  assert.equal(optional[0]!.machineModel, null);
});

test("rejeita cabeçalho incompleto", () => {
  assert.throws(
    () => parseCatalogCsv("schema_version,source\n1,geomaq\n"),
    /CSV_MISSING_COLUMNS:.*external_id.*part_name/,
  );
});

test("rejeita cabeçalho duplicado, desconhecido e linhas com largura divergente", () => {
  assert.throws(
    () => parseCatalogCsv(`${header},source\n`),
    /CSV_DUPLICATE_COLUMNS: source/,
  );
  assert.throws(
    () => parseCatalogCsv(`${header},unexpected\n`),
    /CSV_UNKNOWN_COLUMNS: unexpected/,
  );
  assert.throws(
    () => parseCatalogCsv(`${header}\n1,geomaq,G-1\n`),
    /linha 2: quantidade de colunas inválida/,
  );
});

test("agrega erros de versão, identidade, anos e duplicidade", () => {
  const input = `${header}
2,,X-1,,ABC,INVALID,,,,Trator,,Modelo,2025,2020
1,geomaq,X-2,Peça,ABC,ORIGINAL,,,,,,,1800,
1,geomaq,X-2,Outra peça,DEF,ORIGINAL,,,,,,,,
`;

  assert.throws(
    () => parseCatalogCsv(input),
    (error: Error) => {
      assert.match(error.message, /linha 2: schema_version deve ser 1/);
      assert.match(error.message, /linha 2: source é obrigatório/);
      assert.match(error.message, /linha 2: part_name é obrigatório/);
      assert.match(error.message, /linha 2: code_type inválido/);
      assert.match(error.message, /linha 2: year_end deve ser maior ou igual/);
      assert.match(
        error.message,
        /linha 3: year_start deve estar entre 1900 e 2200/,
      );
      assert.match(error.message, /linha 4: source e external_id duplicados/);
      return true;
    },
  );
});

function validImportRow(
  overrides: Partial<CatalogImportRow> = {},
): CatalogImportRow {
  return {
    schemaVersion: 1,
    source: "geomaq",
    externalId: "G-1",
    partName: "Bomba hidráulica",
    partCode: "BH-01 / A",
    codeType: "ORIGINAL",
    brand: "John Deere",
    category: "Hidráulica",
    description: "Bomba para circuito hidráulico",
    machineType: "Trator",
    machineBrand: "John Deere",
    machineModel: "6110J",
    yearStart: 2015,
    yearEnd: 2020,
    ...overrides,
  };
}

test(
  "importa peça, código normalizado, compatibilidade e vínculo legado",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const summary = await importCatalog(pool, [validImportRow()]);
      assert.deepEqual(summary, {
        rows: 1,
        parts: 1,
        codes: 1,
        fitments: 1,
        links: 1,
      });
      const imported = await pool.query(`
        select p.name, p.description, pc.normalized_code,
               pf.year_start, pf.year_end, l.source, l.external_id
          from marketplace.part p
          join marketplace.part_code pc on pc.part_id = p.id
          join marketplace.part_fitment pf on pf.part_id = p.id
          join marketplace.legacy_catalog_link l on l.entity_id = p.id
      `);
      assert.deepEqual(imported.rows, [
        {
          name: "Bomba hidráulica",
          description: "Bomba para circuito hidráulico",
          normalized_code: "BH01A",
          year_start: 2015,
          year_end: 2020,
          source: "geomaq",
          external_id: "G-1",
        },
      ]);
    });
  },
);

test(
  "reimporta idempotentemente e atualiza campos descritivos sem trocar IDs",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      await importCatalog(pool, [validImportRow()]);
      const before = await pool.query(
        "select p.id,l.id as link_id from marketplace.part p join marketplace.legacy_catalog_link l on l.entity_id=p.id",
      );
      const summary = await importCatalog(pool, [
        validImportRow({
          partName: "Bomba hidráulica revisada",
          description: "Descrição atualizada",
        }),
      ]);
      const after = await pool.query(
        "select p.id,p.name,p.description,l.id as link_id from marketplace.part p join marketplace.legacy_catalog_link l on l.entity_id=p.id",
      );

      assert.deepEqual(summary, {
        rows: 1,
        parts: 1,
        codes: 1,
        fitments: 1,
        links: 1,
      });
      assert.equal(after.rows[0].id, before.rows[0].id);
      assert.equal(after.rows[0].link_id, before.rows[0].link_id);
      assert.equal(after.rows[0].name, "Bomba hidráulica revisada");
      assert.equal(after.rows[0].description, "Descrição atualizada");
    });
  },
);

test(
  "serializa importações concorrentes da mesma origem sem criar órfãos",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      await Promise.all([
        importCatalog(pool, [validImportRow()]),
        importCatalog(pool, [
          validImportRow({ partName: "Bomba concorrente" }),
        ]),
      ]);

      const counts = await pool.query(
        `select
           (select count(*)::integer from marketplace.part) as parts,
           (select count(*)::integer from marketplace.part_code) as codes,
           (select count(*)::integer from marketplace.part_fitment) as fitments,
           (select count(*)::integer from marketplace.legacy_catalog_link) as links`,
      );
      assert.deepEqual(counts.rows[0], {
        parts: 1,
        codes: 1,
        fitments: 1,
        links: 1,
      });
    });
  },
);

test(
  "adquire locks em ordem canônica para arquivos concorrentes em ordem inversa",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const first = validImportRow({ externalId: "A", partCode: "A-1" });
      const second = validImportRow({ externalId: "B", partCode: "B-1" });
      await Promise.all([
        importCatalog(pool, [first, second]),
        importCatalog(pool, [second, first]),
      ]);

      const counts = await pool.query(
        `select
           (select count(*)::integer from marketplace.part) as parts,
           (select count(*)::integer from marketplace.legacy_catalog_link) as links`,
      );
      assert.deepEqual(counts.rows[0], { parts: 2, links: 2 });
    });
  },
);

test(
  "reverte todo o arquivo quando uma linha viola o banco",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const invalid = validImportRow({
        externalId: "G-2",
        partCode: "INV-2",
        codeType: "INVALID" as CatalogImportRow["codeType"],
      });

      await assert.rejects(
        importCatalog(pool, [validImportRow(), invalid]),
        (error: Error & { code?: string }) => error.code === "23514",
      );
      const counts = await pool.query(
        "select (select count(*)::integer from marketplace.part) as parts, (select count(*)::integer from marketplace.legacy_catalog_link) as links",
      );
      assert.deepEqual(counts.rows[0], { parts: 0, links: 0 });
    });
  },
);
