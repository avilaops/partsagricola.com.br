import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { applyMigrations } from "./migrations.js";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;
const migrationsUrl = new URL("../sql/", import.meta.url);

test(
  "busca mantém p95 abaixo de 300 ms com 100 mil anúncios",
  { skip: !adminUrl, timeout: 120_000 },
  async (context) => {
    assert.ok(adminUrl);
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    const database = `partsagricola_perf_${crypto.randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const target = new URL(adminUrl);
    target.pathname = `/${database}`;
    const pool = new pg.Pool({ connectionString: target.toString(), max: 5 });
    try {
      await applyMigrations(pool, migrationsUrl);
      await seedPerformanceData(pool);
      const query = `
        select l.id
          from marketplace.listing l
          join marketplace.company c on c.id=l.company_id
         where c.market_id=$1
           and c.status='APPROVED'
           and l.status='PUBLISHED'
           and marketplace.normalize_search($2) <% l.search_text
         order by word_similarity(marketplace.normalize_search($2),l.search_text) desc,l.id
         limit 24`;
      const market = await pool.query<{ id: string }>(
        "select id from marketplace.market where code='BR'",
      );
      for (let warmup = 0; warmup < 3; warmup += 1) {
        await pool.query(query, [
          market.rows[0]!.id,
          "bomba hidraulica mf 290",
        ]);
      }
      const times: number[] = [];
      for (let run = 0; run < 10; run += 1) {
        const explained = await pool.query<{
          "QUERY PLAN": Array<Record<string, unknown>>;
        }>(`explain (analyze,buffers,format json) ${query}`, [
          market.rows[0]!.id,
          "bomba hidraulica mf 290",
        ]);
        const plan = explained.rows[0]!["QUERY PLAN"][0] as {
          "Execution Time": number;
        };
        times.push(plan["Execution Time"]);
      }
      times.sort((left, right) => left - right);
      const p95 = times[Math.ceil(times.length * 0.95) - 1]!;
      context.diagnostic(
        `100k catalog search p95=${p95.toFixed(2)}ms runs=${times.map((time) => time.toFixed(2)).join(",")}`,
      );
      assert.ok(p95 < 300, `catalog search p95 ${p95.toFixed(2)}ms >= 300ms`);
      const accepted = await pool.query<{ title: string }>(
        `select l.title
           from marketplace.listing l
          where marketplace.normalize_search($1) <% l.search_text
          order by word_similarity(marketplace.normalize_search($1),l.search_text) desc
          limit 1`,
        ["bomba hidraulica mf 290"],
      );
      assert.equal(accepted.rows[0]!.title, "Bomba hidráulica MF 290");
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
    }
  },
);

async function seedPerformanceData(pool: pg.Pool): Promise<void> {
  await pool.query(`
    insert into marketplace.currency(code,name,symbol) values ('BRL','Real','R$');
    insert into marketplace.market(code,name,default_currency,default_locale,timezone,active)
      values ('BR','Brasil','BRL','pt-BR','America/Sao_Paulo',true);
    insert into marketplace.company
      (market_id,cnpj,legal_name,trade_name,slug,email,state_code,city,status,approved_at)
      select id,'11222333000181','Agro Peças LTDA','Agro Peças','agro-pecas',
             'contato@example.test','SP','Ribeirão Preto','APPROVED',now()
        from marketplace.market where code='BR';
    insert into marketplace.machine_type(name,slug) values ('Trator','trator');
    insert into marketplace.brand(name,slug) values ('Massey Ferguson','massey-ferguson');
    insert into marketplace.machine_model(machine_type_id,brand_id,name,slug,year_start,year_end)
      select mt.id,b.id,'MF 290','mf-290',1982,2005
        from marketplace.machine_type mt, marketplace.brand b;
    insert into marketplace.part_category(name,slug) values ('Hidráulica','hidraulica');
    insert into marketplace.part(category_id,name,slug,description)
      select id,'Bomba hidráulica','bomba-hidraulica','Aplicação no sistema hidráulico'
        from marketplace.part_category;
    insert into marketplace.part_code(part_id,code,kind)
      select id,'BH-290','ORIGINAL' from marketplace.part;
    insert into marketplace.part_fitment(part_id,machine_model_id,year_start,year_end)
      select p.id,m.id,1982,2005 from marketplace.part p, marketplace.machine_model m;
    alter table marketplace.listing disable trigger listing_refresh_search;
    insert into marketplace.listing
      (company_id,listing_type,part_id,title,description,condition,
       price_amount_minor,price_currency,price_on_request,warranty_months,
       state_code,city,status,published_at,search_text)
      select c.id,'PART',p.id,
             case when sequence=4242 then 'Bomba hidráulica MF 290' else 'Filtro diesel ' || sequence end,
             case when sequence=4242 then 'Compatível com Massey Ferguson MF 290' else 'Peça agrícola para manutenção preventiva' end,
             'NEW',100000+sequence,'BRL',false,12,'SP','Ribeirão Preto','PUBLISHED',
             now()-(sequence || ' seconds')::interval,
             case when sequence=4242
               then 'bomba hidraulica mf 290 bh 290 massey ferguson trator'
               else 'filtro diesel peca agricola manutencao preventiva ' || sequence
             end
        from marketplace.company c
        cross join marketplace.part p
        cross join generate_series(1,100000) sequence;
    alter table marketplace.listing enable trigger listing_refresh_search;
    analyze marketplace.listing;
    analyze marketplace.company;
  `);
}
