import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { applyMigrations } from "../../../../packages/db/src/migrations.ts";
import { PostgresModerationRepository } from "./postgres-repository.ts";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;

test(
  "revisão PostgreSQL aplica política progressiva e mantém histórico por empresa",
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
      const market = await pool.query<{ id: string }>(
        "insert into marketplace.market(code,name,default_currency,default_locale,timezone,active) values ('BR','Brasil','BRL','pt-BR','America/Sao_Paulo',true) returning id",
      );
      const users = await pool.query<{ id: string }>(
        "insert into marketplace.app_user(email,name) values ('reviewer@example.test','Reviewer'),('seller@example.test','Seller') returning id",
      );
      const company = await pool.query<{ id: string }>(
        "insert into marketplace.company(market_id,cnpj,legal_name,trade_name,slug,email,state_code,city) values ($1,'12345678000195','Loja LTDA','Loja','loja','seller@example.test','SP','Ribeirao Preto') returning id",
        [market.rows[0]!.id],
      );
      const flags = await pool.query<{ id: string }>(
        `insert into marketplace.moderation_flag
          (market_id,company_id,user_id,content_type,content_id,decision,reasons,source)
         values ($1,$2,$3,'STORE',$2,'BLOCK','["PHONE"]','SYNC'),
                ($1,$2,$3,'STORE',$2,'BLOCK','["PHONE"]','SYNC'),
                ($1,$2,$3,'STORE',$2,'BLOCK','["PHONE"]','SYNC') returning id`,
        [market.rows[0]!.id, company.rows[0]!.id, users.rows[1]!.id],
      );
      const repository = new PostgresModerationRepository(pool);
      for (const [index, flag] of flags.rows.entries()) {
        const reviewed = await repository.reviewFlag({
          marketId: market.rows[0]!.id,
          flagId: flag.id,
          reviewerUserId: users.rows[0]!.id,
          outcome: "CONFIRMED",
          note: `Ocorrência ${index + 1}`,
        });
        assert.equal(reviewed.flag.status, "RESOLVED");
        assert.equal(
          reviewed.sanction?.kind,
          index < 2 ? "WARNING" : "SUSPENSION",
        );
      }
      await repository.updatePolicy({
        marketId: market.rows[0]!.id,
        actorUserId: users.rows[0]!.id,
        warningThreshold: 2,
        suspendThreshold: 4,
        blockThreshold: 6,
        suspensionHours: 48,
      });
      assert.equal(
        (await repository.getPolicy(market.rows[0]!.id)).suspensionHours,
        48,
      );
      const history = await repository.history({
        marketId: market.rows[0]!.id,
        companyId: company.rows[0]!.id,
      });
      assert.equal(history.flags.length, 3);
      assert.equal(history.sanctions.length, 3);
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
    }
  },
);
