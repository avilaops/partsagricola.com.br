import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { applyMigrations } from "./migrations.js";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;
const migrationsUrl = new URL("../sql/", import.meta.url);

async function withDatabase(
  run: (pool: pg.Pool) => Promise<void>,
): Promise<void> {
  assert.ok(adminUrl, "MARKETPLACE_TEST_ADMIN_URL is required");
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const database = `partsagricola_test_${crypto.randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const target = new URL(adminUrl);
  target.pathname = `/${database}`;
  const pool = new pg.Pool({ connectionString: target.toString(), max: 5 });
  try {
    await applyMigrations(pool, migrationsUrl);
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
}

test(
  "normaliza acentos e mantém o documento de busca de códigos e compatibilidades",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const normalized = await pool.query<{ value: string }>(
        "select marketplace.normalize_search('  Bomba Hidráulica MF-290  ') as value",
      );
      assert.equal(normalized.rows[0]!.value, "bomba hidraulica mf 290");

      const fixture = await createSearchFixture(pool);
      const search = await pool.query<{ search_text: string }>(
        "select search_text from marketplace.listing where id=$1",
        [fixture.publishedListingId],
      );
      assert.match(search.rows[0]!.search_text, /bomba hidraulica/);
      assert.match(search.rows[0]!.search_text, /bh 290/);
      assert.match(search.rows[0]!.search_text, /massey ferguson/);
      assert.match(search.rows[0]!.search_text, /mf 290/);

      await pool.query(
        "insert into marketplace.part_code(part_id,code,kind) values ($1,'EQ-290','EQUIVALENT')",
        [fixture.partId],
      );
      const refreshed = await pool.query<{ search_text: string }>(
        "select search_text from marketplace.listing where id=$1",
        [fixture.publishedListingId],
      );
      assert.match(refreshed.rows[0]!.search_text, /eq 290/);
    });
  },
);

test(
  "modela associações, desativação, garantia, rating e taxas sem ponto flutuante",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const fixture = await createSearchFixture(pool);
      const association = await pool.query<{ count: number }>(
        `select count(*)::integer as count
           from marketplace.machine_type_brand
          where machine_type_id=$1 and brand_id=$2 and active=true`,
        [fixture.machineTypeId, fixture.machineBrandId],
      );
      assert.equal(association.rows[0]!.count, 1);

      const listing = await pool.query<{
        warranty_months: number;
        rating_average: string;
        rating_count: number;
      }>(
        `select warranty_months,rating_average::text,rating_count
           from marketplace.listing where id=$1`,
        [fixture.publishedListingId],
      );
      assert.deepEqual(listing.rows[0], {
        warranty_months: 12,
        rating_average: "0.00",
        rating_count: 0,
      });
      await assert.rejects(
        pool.query(
          "update marketplace.listing set warranty_months=121 where id=$1",
          [fixture.publishedListingId],
        ),
        /listing_warranty_months_check/,
      );

      await pool.query(
        "insert into marketplace.currency(code,name,symbol) values ('USD','Dólar','$')",
      );
      await pool.query(
        `insert into marketplace.exchange_rate
           (base_currency,quote_currency,rate,effective_at)
         values ('BRL','USD',0.2,'2026-10-18T12:00:00Z')`,
      );
      const rate = await pool.query<{ rate: string }>(
        "select rate::text from marketplace.exchange_rate where base_currency='BRL' and quote_currency='USD'",
      );
      assert.equal(rate.rows[0]!.rate, "0.2000000000");

      for (const table of [
        "machine_model",
        "part",
        "part_code",
        "part_fitment",
      ]) {
        const result = await pool.query<{ active: boolean }>(
          `select active from marketplace.${table} limit 1`,
        );
        assert.equal(result.rows[0]!.active, true);
      }
    });
  },
);

test(
  "consulta base exclui mercado diferente, empresa pendente e anúncio não publicado",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const fixture = await createSearchFixture(pool);
      const visible = await pool.query<{ id: string }>(
        `select l.id
           from marketplace.listing l
           join marketplace.company c on c.id=l.company_id
          where c.market_id=$1
            and c.status='APPROVED'
            and l.status='PUBLISHED'
            and word_similarity(marketplace.normalize_search($2), l.search_text) > 0.3
          order by l.id`,
        [fixture.marketId, "bomba hidraulica mf 290"],
      );
      assert.deepEqual(visible.rows, [{ id: fixture.publishedListingId }]);
    });
  },
);

async function createSearchFixture(pool: pg.Pool) {
  await pool.query(
    "insert into marketplace.currency(code,name,symbol) values ('BRL','Real','R$')",
  );
  const market = await pool.query<{ id: string }>(
    `insert into marketplace.market
       (code,name,default_currency,default_locale,timezone,active)
     values ('BR','Brasil','BRL','pt-BR','America/Sao_Paulo',true) returning id`,
  );
  const otherMarket = await pool.query<{ id: string }>(
    `insert into marketplace.market
       (code,name,default_currency,default_locale,timezone,active)
     values ('AR','Argentina','BRL','es-AR','America/Argentina/Buenos_Aires',true) returning id`,
  );
  const company = await createCompany(
    pool,
    market.rows[0]!.id,
    "11",
    "APPROVED",
  );
  const pending = await createCompany(
    pool,
    market.rows[0]!.id,
    "22",
    "PENDING",
  );
  const foreign = await createCompany(
    pool,
    otherMarket.rows[0]!.id,
    "33",
    "APPROVED",
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
    `insert into marketplace.machine_model
       (machine_type_id,brand_id,name,slug,year_start,year_end)
     values ($1,$2,'MF 290','mf-290',1982,2005) returning id`,
    [machineType.rows[0]!.id, machineBrand.rows[0]!.id],
  );
  const category = await pool.query<{ id: string }>(
    "insert into marketplace.part_category(name,slug) values ('Hidráulica','hidraulica') returning id",
  );
  const part = await pool.query<{ id: string }>(
    `insert into marketplace.part(category_id,name,slug,description)
     values ($1,'Bomba hidráulica','bomba-hidraulica','Aplicação no sistema hidráulico') returning id`,
    [category.rows[0]!.id],
  );
  await pool.query(
    "insert into marketplace.part_code(part_id,code,kind) values ($1,'BH-290','ORIGINAL')",
    [part.rows[0]!.id],
  );
  await pool.query(
    `insert into marketplace.part_fitment
       (part_id,machine_model_id,year_start,year_end)
     values ($1,$2,1982,2005)`,
    [part.rows[0]!.id, model.rows[0]!.id],
  );
  const listings = [] as string[];
  for (const [companyId, status] of [
    [company, "PUBLISHED"],
    [pending, "DRAFT"],
    [foreign, "PUBLISHED"],
    [company, "DRAFT"],
  ] as const) {
    const result = await pool.query<{ id: string }>(
      `insert into marketplace.listing
         (company_id,listing_type,part_id,title,description,condition,
          price_amount_minor,price_currency,price_on_request,warranty_months,
          state_code,city,status,published_at)
       values ($1,'PART',$2,'Bomba hidráulica MF 290',
          'Bomba revisada compatível com o trator', 'RECONDITIONED',
          125000,'BRL',false,12,'SP','Ribeirão Preto',$3,
          case when $3='PUBLISHED' then now() else null end)
       returning id`,
      [companyId, part.rows[0]!.id, status],
    );
    listings.push(result.rows[0]!.id);
  }
  return {
    marketId: market.rows[0]!.id,
    machineTypeId: machineType.rows[0]!.id,
    machineBrandId: machineBrand.rows[0]!.id,
    partId: part.rows[0]!.id,
    publishedListingId: listings[0]!,
  };
}

async function createCompany(
  pool: pg.Pool,
  marketId: string,
  prefix: string,
  status: "APPROVED" | "PENDING",
) {
  const cnpj = `${prefix}2223330001${prefix}`.slice(0, 14);
  const result = await pool.query<{ id: string }>(
    `insert into marketplace.company
       (market_id,cnpj,legal_name,trade_name,slug,email,state_code,city,status,approved_at)
     values ($1,$2,$3,$3,$4,$5,'SP','Cidade',$6,
       case when $6='APPROVED' then now() else null end) returning id`,
    [
      marketId,
      cnpj,
      `Empresa ${prefix}`,
      `empresa-${prefix}`,
      `${prefix}@example.test`,
      status,
    ],
  );
  return result.rows[0]!.id;
}
