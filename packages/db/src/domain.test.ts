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
  assert.match(database, /^partsagricola_test_[a-f0-9]{32}$/);
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

async function fixture(pool: pg.Pool) {
  const currency = await pool.query(
    "insert into marketplace.currency (code,name,symbol) values ('BRL','Real','R$') returning code",
  );
  assert.equal(currency.rows[0].code, "BRL");
  const market = await pool.query<{ id: string }>(
    "insert into marketplace.market (code,name,default_currency,default_locale,timezone,active) values ('BR','Brasil','BRL','pt-BR','America/Sao_Paulo',true) returning id",
  );
  const user = await pool.query<{ id: string }>(
    "insert into marketplace.app_user (email,name) values ('buyer@example.test','Buyer') returning id",
  );
  const outsider = await pool.query<{ id: string }>(
    "insert into marketplace.app_user (email,name) values ('outsider@example.test','Outsider') returning id",
  );
  const companies = await pool.query<{ id: string; status: string }>(
    `insert into marketplace.company
       (market_id,cnpj,legal_name,trade_name,slug,email,state_code,city,status,approved_at)
     values
       ($1,'11222333000181','Empresa A LTDA','Empresa A','empresa-a','a@example.test','SP','Ribeirao Preto','APPROVED',now()),
       ($1,'22333444000191','Empresa B LTDA','Empresa B','empresa-b','b@example.test','PR','Londrina','APPROVED',now()),
       ($1,'33444555000101','Empresa Pendente LTDA','Empresa Pendente','empresa-pendente','p@example.test','GO','Goiania','PENDING',null)
     returning id,status`,
    [market.rows[0]!.id],
  );
  const approvedA = companies.rows.find((row) => row.status === "APPROVED")!.id;
  const approvedB = companies.rows.filter(
    (row) => row.status === "APPROVED",
  )[1]!.id;
  const pending = companies.rows.find((row) => row.status === "PENDING")!.id;
  await pool.query(
    "insert into marketplace.company_member (company_id,user_id,role) values ($1,$2,'OWNER')",
    [approvedA, user.rows[0]!.id],
  );
  return {
    userId: user.rows[0]!.id,
    outsiderId: outsider.rows[0]!.id,
    approvedA,
    approvedB,
    pending,
  };
}

async function createListing(
  pool: pg.Pool,
  companyId: string,
  status = "DRAFT",
) {
  const result = await pool.query<{ id: string }>(
    `insert into marketplace.listing
       (company_id,listing_type,title,description,condition,price_on_request,state_code,city,status,published_at)
     values ($1,'PART','Bomba hidráulica','Bomba hidráulica para trator','USED',true,'SP','Ribeirao Preto',$2,case when $2='PUBLISHED' then now() else null end)
     returning id`,
    [companyId, status],
  );
  return result.rows[0]!.id;
}

test(
  "cria somente as tabelas necessárias ao marketplace de classificados",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const result = await pool.query<{ table_name: string }>(`
        select table_name
          from information_schema.tables
         where table_schema = 'marketplace' and table_type = 'BASE TABLE'
         order by table_name
      `);
      assert.deepEqual(
        result.rows.map((row) => row.table_name),
        [
          "app_setting",
          "app_user",
          "audit_log",
          "auth_authorization_code",
          "auth_client",
          "auth_client_redirect",
          "auth_connector",
          "auth_credential",
          "auth_identity",
          "auth_login_attempt",
          "auth_one_time_token",
          "auth_refresh_token",
          "auth_role",
          "auth_session",
          "auth_social_signup",
          "auth_transaction",
          "auth_user_role",
          "brand",
          "company",
          "company_document",
          "company_member",
          "conversation",
          "conversation_participant",
          "currency",
          "exchange_rate",
          "favorite",
          "feature_flag",
          "image_job",
          "legacy_catalog_link",
          "listing",
          "listing_image",
          "listing_interest",
          "machine_model",
          "machine_type",
          "machine_type_brand",
          "market",
          "message",
          "notification",
          "part",
          "part_category",
          "part_code",
          "part_fitment",
          "part_request",
          "part_request_image",
          "proposal",
        ],
      );
    });
  },
);

test(
  "impede interesse e proposta de atravessarem a empresa do anúncio",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const actors = await fixture(pool);
      const listingId = await createListing(pool, actors.approvedA);

      await assert.rejects(
        pool.query(
          `insert into marketplace.listing_interest
             (listing_id,advertiser_company_id,buyer_user_id,correlation_id)
           values ($1,$2,$3,gen_random_uuid())`,
          [listingId, actors.approvedB, actors.userId],
        ),
        (error: Error & { code?: string }) => error.code === "23503",
      );

      const interest = await pool.query<{ id: string }>(
        `insert into marketplace.listing_interest
           (listing_id,advertiser_company_id,buyer_user_id,correlation_id)
         values ($1,$2,$3,gen_random_uuid()) returning id`,
        [listingId, actors.approvedA, actors.userId],
      );
      await assert.rejects(
        pool.query(
          `insert into marketplace.proposal
             (interest_id,advertiser_company_id,created_by_user_id,direction,terms)
           values ($1,$2,$3,'BUYER_TO_ADVERTISER','Proposta comercial')`,
          [interest.rows[0]!.id, actors.approvedB, actors.userId],
        ),
        (error: Error & { code?: string }) => error.code === "23503",
      );
    });
  },
);

test(
  "usuário só representa empresa compradora da qual é membro",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const actors = await fixture(pool);
      const listingId = await createListing(pool, actors.approvedA);

      await assert.rejects(
        pool.query(
          `insert into marketplace.listing_interest
             (listing_id,advertiser_company_id,buyer_user_id,buyer_company_id,correlation_id)
           values ($1,$2,$3,$4,gen_random_uuid())`,
          [listingId, actors.approvedA, actors.userId, actors.approvedB],
        ),
        /COMPANY_MEMBERSHIP_NOT_ACTIVE/,
      );
      await assert.rejects(
        pool.query(
          `insert into marketplace.part_request
             (buyer_user_id,buyer_company_id,title,description)
           values ($1,$2,'Preciso de vedação','Procuro vedação para implemento')`,
          [actors.userId, actors.approvedB],
        ),
        /COMPANY_MEMBERSHIP_NOT_ACTIVE/,
      );
    });
  },
);

test(
  "protege publicação, valores e compatibilidade dos tipos de anúncio",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const actors = await fixture(pool);
      await assert.rejects(
        createListing(pool, actors.pending, "PUBLISHED"),
        /LISTING_COMPANY_NOT_APPROVED/,
      );
      const published = await createListing(
        pool,
        actors.approvedA,
        "PUBLISHED",
      );
      await assert.rejects(
        pool.query("update marketplace.listing set company_id=$2 where id=$1", [
          published,
          actors.pending,
        ]),
        /LISTING_COMPANY_NOT_APPROVED/,
      );
      await pool.query(
        "update marketplace.company set status='SUSPENDED' where id=$1",
        [actors.approvedA],
      );
      const paused = await pool.query<{ status: string }>(
        "select status from marketplace.listing where id=$1",
        [published],
      );
      assert.equal(paused.rows[0]!.status, "PAUSED");
      await assert.rejects(
        pool.query(
          `insert into marketplace.listing
             (company_id,listing_type,title,description,condition,price_on_request,price_amount_minor,price_currency,state_code,city)
           values ($1,'PART','Filtro agrícola','Filtro agrícola novo','NEW',false,-1,'BRL','SP','Franca')`,
          [actors.approvedA],
        ),
        (error: Error & { code?: string }) => error.code === "23514",
      );
      await assert.rejects(
        pool.query(
          `insert into marketplace.listing
             (company_id,listing_type,title,description,condition,price_on_request,price_amount_minor,price_currency,state_code,city)
           values ($1,'PART','Filtro agrícola','Filtro agrícola novo','NEW',false,100,'ZZZ','SP','Franca')`,
          [actors.approvedA],
        ),
        (error: Error & { code?: string }) => error.code === "23503",
      );

      const part = await pool.query<{ id: string }>(
        "insert into marketplace.part (name,slug) values ('Filtro','filtro') returning id",
      );
      await assert.rejects(
        pool.query(
          `insert into marketplace.listing
             (company_id,listing_type,part_id,title,description,condition,price_on_request,state_code,city)
           values ($1,'MACHINE',$2,'Trator anunciado','Trator agrícola usado','USED',true,'SP','Franca')`,
          [actors.approvedA, part.rows[0]!.id],
        ),
        (error: Error & { code?: string }) => error.code === "23514",
      );
    });
  },
);

test(
  "serializa publicação concorrente com suspensão da empresa",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const actors = await fixture(pool);
      const suspension = await pool.connect();
      const publication = await pool.connect();
      try {
        await suspension.query("begin");
        await suspension.query(
          "update marketplace.company set status='SUSPENDED' where id=$1",
          [actors.approvedA],
        );

        let settled = false;
        const publishing = publication.query(
          `insert into marketplace.listing
               (company_id,listing_type,title,description,condition,price_on_request,state_code,city,status,published_at)
             values ($1,'PART','Publicação concorrente','Descrição suficiente','USED',true,'SP','Franca','PUBLISHED',now())`,
          [actors.approvedA],
        );
        void publishing.then(
          () => {
            settled = true;
          },
          () => {
            settled = true;
          },
        );
        await new Promise((resolve) => setTimeout(resolve, 75));
        assert.equal(settled, false, "publicação deve aguardar a suspensão");
        await suspension.query("commit");
        await assert.rejects(publishing, /LISTING_COMPANY_NOT_APPROVED/);
      } finally {
        await suspension.query("rollback").catch(() => undefined);
        suspension.release();
        publication.release();
      }
    });
  },
);

test(
  "valida tipo e existência dos vínculos legados",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const part = await pool.query<{ id: string }>(
        "insert into marketplace.part (name,slug) values ('Peça','legacy-part') returning id",
      );
      await assert.rejects(
        pool.query(
          "insert into marketplace.legacy_catalog_link (source,external_id,entity_type,entity_id) values ('legacy','missing','PART',gen_random_uuid())",
        ),
        /LEGACY_ENTITY_NOT_FOUND/,
      );
      await assert.rejects(
        pool.query(
          "insert into marketplace.legacy_catalog_link (source,external_id,entity_type,entity_id) values ('legacy','wrong-type','MACHINE_MODEL',$1)",
          [part.rows[0]!.id],
        ),
        /LEGACY_ENTITY_NOT_FOUND/,
      );
      await pool.query(
        "insert into marketplace.legacy_catalog_link (source,external_id,entity_type,entity_id) values ('legacy','part','PART',$1)",
        [part.rows[0]!.id],
      );
      await assert.rejects(
        pool.query("delete from marketplace.part where id=$1", [
          part.rows[0]!.id,
        ]),
        /LEGACY_ENTITY_STILL_REFERENCED/,
      );
    });
  },
);

test(
  "serializa criação de vínculo legado com remoção da entidade",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const part = await pool.query<{ id: string }>(
        "insert into marketplace.part (name,slug) values ('Peça concorrente','legacy-race') returning id",
      );
      const removal = await pool.connect();
      const linking = await pool.connect();
      try {
        await removal.query("begin");
        await removal.query("delete from marketplace.part where id=$1", [
          part.rows[0]!.id,
        ]);

        let settled = false;
        const inserting = linking.query(
          "insert into marketplace.legacy_catalog_link (source,external_id,entity_type,entity_id) values ('legacy','race','PART',$1)",
          [part.rows[0]!.id],
        );
        void inserting.then(
          () => {
            settled = true;
          },
          () => {
            settled = true;
          },
        );
        await new Promise((resolve) => setTimeout(resolve, 75));
        assert.equal(settled, false, "vínculo deve aguardar a remoção");
        await removal.query("commit");
        await assert.rejects(inserting, /LEGACY_ENTITY_NOT_FOUND/);
      } finally {
        await removal.query("rollback").catch(() => undefined);
        removal.release();
        linking.release();
      }
    });
  },
);

test(
  "impede membros inativos de representar empresas",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const actors = await fixture(pool);
      await pool.query(
        "update marketplace.company_member set active=false where company_id=$1 and user_id=$2",
        [actors.approvedA, actors.userId],
      );
      const listingId = await createListing(pool, actors.approvedB);
      await assert.rejects(
        pool.query(
          `insert into marketplace.listing_interest
             (listing_id,advertiser_company_id,buyer_user_id,buyer_company_id,correlation_id)
           values ($1,$2,$3,$4,gen_random_uuid())`,
          [listingId, actors.approvedB, actors.userId, actors.approvedA],
        ),
        /COMPANY_MEMBERSHIP_NOT_ACTIVE/,
      );
      await assert.rejects(
        pool.query(
          `insert into marketplace.part_request
             (buyer_user_id,buyer_company_id,title,description)
           values ($1,$2,'Preciso de peça','Descrição suficiente da peça')`,
          [actors.userId, actors.approvedA],
        ),
        /COMPANY_MEMBERSHIP_NOT_ACTIVE/,
      );
    });
  },
);

test(
  "garante autoria, direção e empresa emissora das propostas",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const actors = await fixture(pool);
      await pool.query(
        "insert into marketplace.company_member (company_id,user_id,role) values ($1,$2,'OWNER')",
        [actors.approvedB, actors.userId],
      );
      const listingId = await createListing(pool, actors.approvedA);
      const interest = await pool.query<{ id: string }>(
        `insert into marketplace.listing_interest
           (listing_id,advertiser_company_id,buyer_user_id,buyer_company_id,correlation_id)
         values ($1,$2,$3,$4,gen_random_uuid()) returning id`,
        [listingId, actors.approvedA, actors.userId, actors.approvedB],
      );

      await assert.rejects(
        pool.query(
          `insert into marketplace.proposal
             (interest_id,advertiser_company_id,created_by_user_id,issuer_company_id,direction,terms)
           values ($1,$2,$3,$4,'BUYER_TO_ADVERTISER','Empresa incorreta')`,
          [
            interest.rows[0]!.id,
            actors.approvedA,
            actors.userId,
            actors.approvedA,
          ],
        ),
        /PROPOSAL_BUYER_IDENTITY_INVALID/,
      );
      await assert.rejects(
        pool.query(
          `insert into marketplace.proposal
             (interest_id,advertiser_company_id,created_by_user_id,direction,terms)
           values ($1,$2,$3,'ADVERTISER_TO_BUYER','Sem empresa emissora')`,
          [interest.rows[0]!.id, actors.approvedA, actors.userId],
        ),
        /PROPOSAL_ADVERTISER_IDENTITY_INVALID/,
      );
      await pool.query(
        `insert into marketplace.proposal
           (interest_id,advertiser_company_id,created_by_user_id,issuer_company_id,direction,terms)
         values ($1,$2,$3,$4,'BUYER_TO_ADVERTISER','Proposta válida')`,
        [
          interest.rows[0]!.id,
          actors.approvedA,
          actors.userId,
          actors.approvedB,
        ],
      );
    });
  },
);

test(
  "protege compatibilidade, favoritos, participantes e autoria de mensagens",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const actors = await fixture(pool);
      const type = await pool.query<{ id: string }>(
        "insert into marketplace.machine_type (name,slug) values ('Trator','trator') returning id",
      );
      const brand = await pool.query<{ id: string }>(
        "insert into marketplace.brand (name,slug) values ('Marca','marca') returning id",
      );
      const model = await pool.query<{ id: string }>(
        "insert into marketplace.machine_model (machine_type_id,brand_id,name,slug) values ($1,$2,'Modelo','modelo') returning id",
        [type.rows[0]!.id, brand.rows[0]!.id],
      );
      const part = await pool.query<{ id: string }>(
        "insert into marketplace.part (name,slug) values ('Peça','peca') returning id",
      );
      await assert.rejects(
        pool.query(
          "insert into marketplace.part_fitment (part_id,machine_model_id,year_start,year_end) values ($1,$2,2025,2020)",
          [part.rows[0]!.id, model.rows[0]!.id],
        ),
        (error: Error & { code?: string }) => error.code === "23514",
      );

      const listingId = await createListing(pool, actors.approvedA);
      await pool.query(
        "insert into marketplace.favorite (user_id,listing_id) values ($1,$2)",
        [actors.userId, listingId],
      );
      await assert.rejects(
        pool.query(
          "insert into marketplace.favorite (user_id,listing_id) values ($1,$2)",
          [actors.userId, listingId],
        ),
        (error: Error & { code?: string }) => error.code === "23505",
      );

      const request = await pool.query<{ id: string }>(
        "insert into marketplace.part_request (buyer_user_id,title,description) values ($1,'Preciso de peça','Descrição suficiente da peça') returning id",
        [actors.userId],
      );
      const conversation = await pool.query<{ id: string }>(
        "insert into marketplace.conversation (part_request_id) values ($1) returning id",
        [request.rows[0]!.id],
      );
      await pool.query(
        "insert into marketplace.conversation_participant (conversation_id,user_id) values ($1,$2)",
        [conversation.rows[0]!.id, actors.userId],
      );
      await assert.rejects(
        pool.query(
          "insert into marketplace.conversation_participant (conversation_id,user_id) values ($1,$2)",
          [conversation.rows[0]!.id, actors.userId],
        ),
        (error: Error & { code?: string }) => error.code === "23505",
      );
      await assert.rejects(
        pool.query(
          "insert into marketplace.message (conversation_id,sender_user_id,body) values ($1,$2,'Mensagem indevida')",
          [conversation.rows[0]!.id, actors.outsiderId],
        ),
        (error: Error & { code?: string }) => error.code === "23503",
      );
    });
  },
);

test(
  "não cria entidades de ecommerce nem dinheiro em ponto flutuante",
  { skip: !adminUrl },
  async () => {
    await withDatabase(async (pool) => {
      const forbidden = await pool.query<{ table_name: string }>(
        `
        select table_name
          from information_schema.tables
         where table_schema = 'marketplace'
           and table_name = any($1::text[])
      `,
        [
          [
            "cart",
            "cart_item",
            "order",
            "payment",
            "shipment",
            "inventory",
            "stock",
          ],
        ],
      );
      assert.deepEqual(forbidden.rows, []);

      const unsafeMoney = await pool.query<{
        table_name: string;
        column_name: string;
        data_type: string;
      }>(`
        select table_name, column_name, data_type
          from information_schema.columns
         where table_schema = 'marketplace'
           and (column_name like '%amount%' or column_name like '%price%')
           and data_type in ('real', 'double precision', 'numeric')
      `);
      assert.deepEqual(unsafeMoney.rows, []);
    });
  },
);
