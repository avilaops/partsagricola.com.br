import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { applyMigrations } from "../../../../packages/db/src/migrations.ts";
import { PostgresChatRepository } from "./postgres-repository.ts";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;

test(
  "repositório PostgreSQL isola participantes e persiste somente corpo seguro",
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
      await applyMigrations(
        pool,
        new URL("../../../../packages/db/sql/", import.meta.url),
      );
      await pool.query(
        "insert into marketplace.currency(code,name,symbol) values ('BRL','Real','R$')",
      );
      const market = await pool.query<{ id: string }>(`
        insert into marketplace.market(code,name,default_currency,default_locale,timezone,active)
        values ('BR','Brasil','BRL','pt-BR','America/Sao_Paulo',true) returning id
      `);
      const users = await pool.query<{ id: string }>(`
        insert into marketplace.app_user(email,name) values
          ('buyer@example.test','Buyer'),('seller@example.test','Seller'),('outsider@example.test','Outsider'),
          ('buyer2@example.test','Buyer 2')
        returning id
      `);
      const [buyer, seller, outsider, buyer2] = users.rows;
      const company = await pool.query<{ id: string }>(
        `insert into marketplace.company
          (market_id,cnpj,legal_name,trade_name,slug,email,state_code,city,status,approved_at)
         values ($1,'12345678000195','Loja LTDA','Loja','loja','seller@example.test','SP','Ribeirao Preto','APPROVED',now())
         returning id`,
        [market.rows[0]!.id],
      );
      await pool.query(
        "insert into marketplace.company_member(company_id,user_id,role) values ($1,$2,'OWNER')",
        [company.rows[0]!.id, seller!.id],
      );
      const part = await pool.query<{ id: string }>(
        "insert into marketplace.part(name,slug,description) values ('Bomba','bomba','Bomba hidraulica') returning id",
      );
      const listing = await pool.query<{ id: string }>(
        `insert into marketplace.listing
          (company_id,listing_type,part_id,title,description,condition,price_on_request,state_code,city,status,published_at)
         values ($1,'PART',$2,'Bomba MF','Bomba hidraulica para MF','NEW',true,'SP','Ribeirao Preto','PUBLISHED',now()) returning id`,
        [company.rows[0]!.id, part.rows[0]!.id],
      );
      const interest = await pool.query<{ id: string }>(
        `insert into marketplace.listing_interest
          (listing_id,advertiser_company_id,buyer_user_id,correlation_id)
         values ($1,$2,$3,$4) returning id`,
        [
          listing.rows[0]!.id,
          company.rows[0]!.id,
          buyer!.id,
          crypto.randomUUID(),
        ],
      );
      const conversation = await pool.query<{ id: string }>(
        `insert into marketplace.conversation
          (interest_id,market_id,context_type,context_id)
         values ($1,$2,'LISTING',$3) returning id`,
        [interest.rows[0]!.id, market.rows[0]!.id, listing.rows[0]!.id],
      );
      const interest2 = await pool.query<{ id: string }>(
        `insert into marketplace.listing_interest
          (listing_id,advertiser_company_id,buyer_user_id,correlation_id)
         values ($1,$2,$3,$4) returning id`,
        [
          listing.rows[0]!.id,
          company.rows[0]!.id,
          buyer2!.id,
          crypto.randomUUID(),
        ],
      );
      const conversation2 = await pool.query<{ id: string }>(
        `insert into marketplace.conversation
          (interest_id,market_id,context_type,context_id)
         values ($1,$2,'LISTING',$3) returning id`,
        [interest2.rows[0]!.id, market.rows[0]!.id, listing.rows[0]!.id],
      );
      assert.notEqual(conversation2.rows[0]!.id, conversation.rows[0]!.id);
      await pool.query(
        `insert into marketplace.conversation_participant(conversation_id,user_id,company_id)
         values ($1,$2,null),($1,$3,$4)`,
        [conversation.rows[0]!.id, buyer!.id, seller!.id, company.rows[0]!.id],
      );
      const repository = new PostgresChatRepository(pool, {
        encryptEvidence: (value) => ({
          ciphertext: Buffer.from(`encrypted:${value}`),
          iv: Buffer.alloc(12, 1),
          authTag: Buffer.alloc(16, 2),
          sha256: "a".repeat(64),
          keyVersion: 1,
        }),
      });
      const sent = await repository.sendMessage({
        marketId: market.rows[0]!.id,
        userId: buyer!.id,
        companyIds: [],
        conversationId: conversation.rows[0]!.id,
        clientMessageId: crypto.randomUUID(),
        safeBody: "[telefone removido]",
        originalBody: "ligue 11 99999-8877",
        moderationStatus: "BLOCK",
        reasons: ["PHONE"],
        attachments: [
          {
            storageKey: `uploads/${buyer!.id}/foto.jpg`,
            mimeType: "image/jpeg",
          },
        ],
      });
      assert.equal(sent.created, true);
      assert.equal(sent.message.safeBody, "[telefone removido]");
      assert.equal(sent.message.attachments[0]!.status, "QUARANTINED");
      const persisted = await pool.query(
        `select m.body,m.safe_body,m.moderation_status,
          (select count(*)::int from marketplace.moderation_flag) flags,
          (select count(*)::int from marketplace.moderation_job) jobs,
          (select count(*)::int from marketplace.moderation_evidence) evidence
         from marketplace.message m where id=$1`,
        [sent.message.id],
      );
      assert.deepEqual(persisted.rows[0], {
        body: "[telefone removido]",
        safe_body: "[telefone removido]",
        moderation_status: "BLOCK",
        flags: 1,
        jobs: 2,
        evidence: 1,
      });
      await assert.rejects(
        repository.listMessages({
          marketId: market.rows[0]!.id,
          userId: outsider!.id,
          conversationId: conversation.rows[0]!.id,
        }),
        /CONVERSATION_NOT_FOUND/,
      );
      const reportInput = {
        marketId: market.rows[0]!.id,
        reporterUserId: seller!.id,
        targetType: "MESSAGE" as const,
        targetId: sent.message.id,
        reason: "CONTACT_ATTEMPT" as const,
      };
      const first = await repository.report(reportInput);
      const repeated = await repository.report(reportInput);
      assert.equal(first.created, true);
      assert.equal(repeated.created, false);
      assert.equal(first.report.id, repeated.report.id);
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
    }
  },
);
