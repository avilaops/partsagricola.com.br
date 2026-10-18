import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";
import { applyMigrations } from "../../../../packages/db/src/migrations.ts";
import { PostgresCatalogRepository } from "./postgres-repository.ts";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;
const migrationsUrl = new URL("../../../../packages/db/sql/", import.meta.url);

type Fixture = Awaited<ReturnType<typeof seed>>;

async function withDatabase(
  run: (pool: pg.Pool, fixture: Fixture) => Promise<void>,
) {
  assert.ok(adminUrl);
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const database = `partsagricola_api_${crypto.randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const target = new URL(adminUrl);
  target.pathname = `/${database}`;
  const pool = new pg.Pool({ connectionString: target.toString(), max: 5 });
  try {
    await applyMigrations(pool, migrationsUrl);
    const fixture = await seed(pool);
    await run(pool, fixture);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
}

test(
  "encontra código ambíguo como lista e navega referências ativas",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool, fixture) => {
      const repository = new PostgresCatalogRepository(pool);
      assert.deepEqual(await repository.listMachineTypes(), [
        { id: fixture.machineTypeId, name: "Trator", slug: "trator" },
      ]);
      assert.deepEqual(await repository.listBrands(fixture.machineTypeId), [
        {
          id: fixture.machineBrandId,
          name: "Massey Ferguson",
          slug: "massey-ferguson",
        },
      ]);
      assert.deepEqual(
        await repository.listYears(fixture.modelId),
        [1982, 1983, 1984, 1985],
      );
      const parts = await repository.findPartsByCode({ code: "BH 290" });
      assert.equal(parts.length, 2);
      assert.equal(parts[0]!.codes[0]!.code, "BH-290");
      assert.equal(parts[0]!.compatibilities[0]!.model, "MF 290");
      await pool.query("update marketplace.part set active=false where id=$1", [
        parts[0]!.id,
      ]);
      assert.deepEqual(await repository.listCompatibilities(parts[0]!.id), []);
    });
  },
);

test(
  "busca tolera erro, isola mercado e converte preço com rótulo aproximado",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool, fixture) => {
      const repository = new PostgresCatalogRepository(pool);
      const result = await repository.search({
        marketId: fixture.marketId,
        query: "bomba hidraulca mf 290",
        machineTypeId: fixture.machineTypeId,
        brandId: fixture.machineBrandId,
        modelId: fixture.modelId,
        year: 1984,
        categoryId: fixture.categoryId,
        condition: "RECONDITIONED",
        stateCode: "SP",
        city: "Ribeirão Preto",
        priceMin: 20000,
        priceMax: 30000,
        hasWarranty: true,
        displayCurrency: "USD",
        sort: "RELEVANCE",
        limit: 24,
      });
      assert.equal(result.data.length, 1);
      assert.equal(result.data[0]!.title, "Bomba hidráulica MF 290");
      assert.deepEqual(result.data[0]!.price, {
        onRequest: false,
        original: { amountMinor: 125000, currency: "BRL" },
        display: { amountMinor: 25000, currency: "USD" },
        approximate: true,
        rateEffectiveAt: "2026-10-18T10:00:00.000Z",
      });
      assert.equal(result.data[0]!.company.name, "Agro Peças");
    });
  },
);

test(
  "pagina todas as ordenações sem duplicar empates e exclui conversão ausente",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool, fixture) => {
      const repository = new PostgresCatalogRepository(pool);
      for (const sort of [
        "RELEVANCE",
        "PRICE_ASC",
        "NEWEST",
        "RATING",
      ] as const) {
        const first = await repository.search({
          marketId: fixture.marketId,
          query: "bomba",
          sort,
          limit: 1,
        });
        assert.equal(first.data.length, 1);
        assert.ok(first.nextCursor);
        const second = await repository.search({
          marketId: fixture.marketId,
          query: "bomba",
          sort,
          limit: 1,
          cursor: first.nextCursor!,
        });
        assert.equal(second.data.length, 1);
        assert.notEqual(second.data[0]!.id, first.data[0]!.id);
      }
      const unavailable = await repository.search({
        marketId: fixture.marketId,
        displayCurrency: "EUR",
        priceMin: 1,
        sort: "PRICE_ASC",
        limit: 24,
      });
      assert.equal(unavailable.data.length, 0);

      const invalidCursor = Buffer.from(
        JSON.stringify({ sort: "NEWEST", keys: [], id: "não-uuid" }),
      ).toString("base64url");
      await assert.rejects(
        repository.search({
          marketId: fixture.marketId,
          sort: "NEWEST",
          cursor: invalidCursor,
          limit: 24,
        }),
        /INVALID_CATALOG_CURSOR/,
      );
    });
  },
);

test(
  "atualiza documento derivado e exclui referências ancestrais inativas",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool, fixture) => {
      const repository = new PostgresCatalogRepository(pool);
      await pool.query(
        "update marketplace.brand set name='MF Renovada' where id=$1",
        [fixture.machineBrandId],
      );
      const refreshed = await pool.query<{ search_text: string }>(
        "select search_text from marketplace.listing where status='PUBLISHED' and company_id in (select id from marketplace.company where market_id=$1) order by id limit 1",
        [fixture.marketId],
      );
      assert.match(refreshed.rows[0]!.search_text, /mf renovada/);

      await pool.query(
        "update marketplace.brand set active=false where id=$1",
        [fixture.machineBrandId],
      );
      assert.deepEqual(
        await repository.listModels({ brandId: fixture.machineBrandId }),
        [],
      );
      assert.deepEqual(await repository.listYears(fixture.modelId), []);
      const hiddenByBrand = await repository.search({
        marketId: fixture.marketId,
        brandId: fixture.machineBrandId,
        sort: "NEWEST",
        limit: 24,
      });
      assert.equal(hiddenByBrand.data.length, 0);
      await pool.query("update marketplace.brand set active=true where id=$1", [
        fixture.machineBrandId,
      ]);

      await pool.query(
        "update marketplace.part_category set active=false where id=$1",
        [fixture.categoryId],
      );
      const hidden = await repository.search({
        marketId: fixture.marketId,
        query: "bomba",
        sort: "RELEVANCE",
        limit: 24,
      });
      assert.equal(hidden.data.length, 0);
    });
  },
);

test(
  "CRUD administrativo cobre todas as referências e importação CSV é transacional",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool, fixture) => {
      const repository = new PostgresCatalogRepository(pool);
      const machineType = await repository.createAdmin("machine-types", {
        name: "Colheitadeira",
        slug: "colheitadeira",
      });
      const brand = await repository.createAdmin("brands", {
        name: "Marca Teste",
        slug: "marca-teste",
      });
      const association = await repository.createAdmin("brand-associations", {
        machineTypeId: machineType.id,
        brandId: brand.id,
      });
      const model = await repository.createAdmin("models", {
        machineTypeId: machineType.id,
        brandId: brand.id,
        name: "Modelo 2026",
        slug: "modelo-2026",
        yearStart: 2025,
        yearEnd: 2026,
      });
      const category = await repository.createAdmin("categories", {
        name: "Teste",
        slug: "teste",
      });
      const part = await repository.createAdmin("parts", {
        categoryId: category.id,
        name: "Peça Teste",
        slug: "peca-teste",
      });
      const code = await repository.createAdmin("codes", {
        partId: part.id,
        code: "TEST-1",
        kind: "ORIGINAL",
      });
      const fitment = await repository.createAdmin("compatibilities", {
        partId: part.id,
        modelId: model.id,
        yearStart: 2025,
        yearEnd: 2026,
      });
      const rate = await repository.createAdmin("exchange-rates", {
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        rate: 0.9,
        effectiveAt: "2026-10-18T12:00:00Z",
      });
      for (const [entity, value] of [
        ["machine-types", machineType],
        ["brands", brand],
        ["brand-associations", association],
        ["models", model],
        ["categories", category],
        ["parts", part],
        ["codes", code],
        ["compatibilities", fitment],
        ["exchange-rates", rate],
      ] as const) {
        assert.ok(
          (await repository.listAdmin(entity)).some(
            (row) => row.id === value.id,
          ),
        );
        assert.deepEqual(
          await repository.deactivateAdmin(entity, value.id as string),
          {
            id: value.id,
            active: false,
          },
        );
      }
      const updated = await repository.updateAdmin(
        "brands",
        brand.id as string,
        {
          name: "Marca Atualizada",
          active: true,
        },
      );
      assert.equal(updated.name, "Marca Atualizada");
      assert.equal(updated.active, true);

      const summary = await repository.importCatalogCsv(
        "schema_version,source,external_id,part_name,part_code,code_type,brand,category,description,machine_type,machine_brand,machine_model,year_start,year_end\n1,admin,ADM-1,Bomba importada,ADM-1,ORIGINAL,,Teste,Descrição importada,,,,,",
      );
      assert.deepEqual(summary, {
        rows: 1,
        parts: 1,
        codes: 1,
        fitments: 0,
        links: 1,
      });
      assert.equal(
        (await repository.findPartsByCode({ code: "ADM-1" })).length,
        1,
      );
      assert.equal(fixture.marketId.length, 36);
    });
  },
);

async function seed(pool: pg.Pool) {
  await pool.query(`
    insert into marketplace.currency(code,name,symbol) values
      ('BRL','Real','R$'),('USD','Dólar','$'),('EUR','Euro','€');
    insert into marketplace.market(code,name,default_currency,default_locale,timezone,active) values
      ('BR','Brasil','BRL','pt-BR','America/Sao_Paulo',true),
      ('AR','Argentina','BRL','es-AR','America/Argentina/Buenos_Aires',true);
  `);
  const market = await pool.query<{ id: string }>(
    "select id from marketplace.market where code='BR'",
  );
  const foreignMarket = await pool.query<{ id: string }>(
    "select id from marketplace.market where code='AR'",
  );
  const company = await createCompany(
    pool,
    market.rows[0]!.id,
    "11",
    "Agro Peças",
  );
  const foreign = await createCompany(
    pool,
    foreignMarket.rows[0]!.id,
    "22",
    "Exterior",
  );
  const machineType = await pool.query<{ id: string }>(
    "insert into marketplace.machine_type(name,slug) values ('Trator','trator') returning id",
  );
  const machineBrand = await pool.query<{ id: string }>(
    "insert into marketplace.brand(name,slug) values ('Massey Ferguson','massey-ferguson') returning id",
  );
  await pool.query(
    "insert into marketplace.machine_type_brand(machine_type_id,brand_id) values ($1,$2)",
    [machineType.rows[0]!.id, machineBrand.rows[0]!.id],
  );
  const model = await pool.query<{ id: string }>(
    `insert into marketplace.machine_model(machine_type_id,brand_id,name,slug,year_start,year_end)
     values ($1,$2,'MF 290','mf-290',1982,1985) returning id`,
    [machineType.rows[0]!.id, machineBrand.rows[0]!.id],
  );
  const category = await pool.query<{ id: string }>(
    "insert into marketplace.part_category(name,slug) values ('Hidráulica','hidraulica') returning id",
  );
  const parts = [] as string[];
  for (const [name, slug] of [
    ["Bomba hidráulica", "bomba-hidraulica"],
    ["Bomba auxiliar", "bomba-auxiliar"],
  ]) {
    const part = await pool.query<{ id: string }>(
      "insert into marketplace.part(category_id,name,slug,description) values ($1,$2,$3,'Peça para circuito hidráulico') returning id",
      [category.rows[0]!.id, name, slug],
    );
    parts.push(part.rows[0]!.id);
    await pool.query(
      "insert into marketplace.part_code(part_id,code,kind) values ($1,'BH-290','ORIGINAL')",
      [part.rows[0]!.id],
    );
    await pool.query(
      "insert into marketplace.part_fitment(part_id,machine_model_id,year_start,year_end) values ($1,$2,1982,1985)",
      [part.rows[0]!.id, model.rows[0]!.id],
    );
  }
  await pool.query(
    `insert into marketplace.exchange_rate(base_currency,quote_currency,rate,effective_at)
     values ('BRL','USD',0.2,'2026-10-18T10:00:00Z')`,
  );
  for (const [index, partId] of parts.entries()) {
    await createListing(pool, company, partId, index, "PUBLISHED");
  }
  await createListing(pool, foreign, parts[0]!, 9, "PUBLISHED");
  await createListing(pool, company, parts[0]!, 10, "DRAFT");
  return {
    marketId: market.rows[0]!.id,
    machineTypeId: machineType.rows[0]!.id,
    machineBrandId: machineBrand.rows[0]!.id,
    modelId: model.rows[0]!.id,
    categoryId: category.rows[0]!.id,
  };
}

async function createCompany(
  pool: pg.Pool,
  marketId: string,
  prefix: string,
  name: string,
) {
  const result = await pool.query<{ id: string }>(
    `insert into marketplace.company
       (market_id,cnpj,legal_name,trade_name,slug,email,state_code,city,status,approved_at)
     values ($1,$2,$3 || ' LTDA',$3,$4,$5,'SP','Ribeirão Preto','APPROVED',now()) returning id`,
    [
      marketId,
      `${prefix}2223330001${prefix}`.slice(0, 14),
      name,
      name.toLowerCase().replace(" ", "-"),
      `${prefix}@example.test`,
    ],
  );
  return result.rows[0]!.id;
}

async function createListing(
  pool: pg.Pool,
  companyId: string,
  partId: string,
  index: number,
  status: "PUBLISHED" | "DRAFT",
) {
  await pool.query(
    `insert into marketplace.listing
       (company_id,listing_type,part_id,title,description,condition,
        price_amount_minor,price_currency,price_on_request,warranty_months,
        state_code,city,status,published_at,rating_average,rating_count)
     values ($1,'PART',$2,$3,'Bomba revisada compatível com o trator',
       'RECONDITIONED',125000,'BRL',false,12,'SP','Ribeirão Preto',$4,
       case when $4='PUBLISHED' then '2026-10-18T12:00:00Z'::timestamptz - ($5 || ' seconds')::interval else null end,
       4.5,12)`,
    [
      companyId,
      partId,
      index === 0 ? "Bomba hidráulica MF 290" : `Bomba auxiliar ${index}`,
      status,
      index,
    ],
  );
}
