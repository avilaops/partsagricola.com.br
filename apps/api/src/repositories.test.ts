import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { applyMigrations } from "../../../packages/db/src/migrations.ts";
import {
  PostgresAuditRepository,
  PostgresImageJobQueue,
  PostgresMarketplaceRepository,
} from "./repositories.ts";

const adminUrl = process.env.MARKETPLACE_TEST_ADMIN_URL;

test(
  "repositórios PostgreSQL persistem auditoria e enfileiram uma imagem idempotente",
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
        new URL("../../../packages/db/sql/", import.meta.url),
      );
      await pool.query(
        "insert into marketplace.currency(code,name,symbol) values ('BRL','Real','R$')",
      );
      const market = await pool.query<{ id: string }>(
        "insert into marketplace.market(code,name,default_currency,default_locale,timezone,active) values ('BR','Brasil','BRL','pt-BR','America/Sao_Paulo',true) returning id",
      );
      const user = await pool.query<{ id: string }>(
        "insert into marketplace.app_user(email,name) values ('api@example.test','API') returning id",
      );
      const company = await pool.query<{ id: string }>(
        `insert into marketplace.company(market_id,cnpj,legal_name,trade_name,slug,email,state_code,city,status,approved_at) values ($1,'12345678000195','API LTDA','API','api','api@example.test','SP','Ribeirao Preto','APPROVED',now()) returning id`,
        [market.rows[0]!.id],
      );
      const sourceKey = `uploads/${company.rows[0]!.id}/${crypto.randomUUID()}.jpg`;
      const queue = new PostgresImageJobQueue(pool);
      const first = await queue.enqueue({
        sourceKey,
        sellerId: company.rows[0]!.id,
        marketId: market.rows[0]!.id,
      });
      const second = await queue.enqueue({
        sourceKey,
        sellerId: company.rows[0]!.id,
        marketId: market.rows[0]!.id,
      });
      assert.equal(second.id, first.id);
      const audit = new PostgresAuditRepository(pool);
      await audit.record({
        actorUserId: user.rows[0]!.id,
        sellerId: company.rows[0]!.id,
        marketId: market.rows[0]!.id,
        action: "UPLOAD_COMPLETED",
        entityType: "image_job",
        entityId: first.id,
        ip: "127.0.0.1",
        diff: { sourceKey },
      });
      const saved = await pool.query(
        "select action,ip_address::text,diff from marketplace.audit_log",
      );
      assert.deepEqual(saved.rows, [
        {
          action: "UPLOAD_COMPLETED",
          ip_address: "127.0.0.1/32",
          diff: { sourceKey },
        },
      ]);
      const category = await pool.query<{ id: string }>(
        "insert into marketplace.part_category(name,slug) values ('Hidráulica','hidraulica') returning id",
      );
      const marketplace = new PostgresMarketplaceRepository(pool);
      const principal = {
        active: true as const,
        sub: user.rows[0]!.id,
        sid: "repository-test",
        email: "api@example.test",
        email_verified: true,
        roles: ["USER"],
        seller_ids: [],
        scope: "openid profile",
      };
      const application = await marketplace.createCompanyApplication(
        principal,
        market.rows[0]!.id,
        {
          cnpj: "98765432000198",
          legalName: "Fornecedor Teste Ltda",
          tradeName: "Fornecedor Teste",
          email: "vendas@fornecedor.example",
          stateCode: "SP",
          city: "Campinas",
          categoryIds: [category.rows[0]!.id],
          serviceRegions: ["SP", "MG"],
        },
      );
      assert.equal(application.status, "PENDING");
      const request = await marketplace.createPartRequest(principal, {
        title: "Bomba hidráulica",
        description: "Aplicação agrícola para teste integrado",
        categoryId: category.rows[0]!.id,
      });
      assert.equal(request.status, "OPEN");
      const dashboard = await marketplace.sellerDashboard(application.id);
      assert.equal(dashboard.company.tradeName, "Fornecedor Teste");
      assert.deepEqual(dashboard.metrics, {
        listings: 0,
        publishedListings: 0,
        pendingListings: 0,
        openInterests: 0,
        openRequests: 0,
        acceptedProposals: 0,
      });
      const listing = await marketplace.createListing(company.rows[0]!.id, {
        title: "Bomba hidráulica John Deere",
        description: "Peça nova para colheitadeira, pronta para envio.",
        condition: "NEW",
        stateCode: "SP",
        city: "Ribeirao Preto",
        priceAmountMinor: 125000,
        priceOnRequest: false,
        imageUrls: ["https://cdn.example.test/bomba.jpg"],
      });
      assert.equal(listing.status, "PENDING_REVIEW");
      await pool.query(
        "update marketplace.listing set status='PUBLISHED',published_at=now() where id=$1",
        [listing.id],
      );
      await pool.query(
        "insert into marketplace.company_member(company_id,user_id,role) values ($1,$2,'OWNER')",
        [company.rows[0]!.id, user.rows[0]!.id],
      );
      const catalog = await marketplace.publicCatalog({
        query: "hidráulica",
        stateCode: "SP",
      });
      assert.equal(catalog.items.length, 1);
      assert.equal(catalog.items[0]?.company.tradeName, "API");
      const publicListing = await marketplace.publicListing(listing.id);
      assert.equal(
        publicListing.images[0]?.url,
        "https://cdn.example.test/bomba.jpg",
      );
      assert.equal(publicListing.company.verified, true);
      await marketplace.addFavorite(principal, listing.id);
      assert.equal(
        (await marketplace.listFavorites(principal.sub)).items.length,
        1,
      );
      await marketplace.removeFavorite(principal.sub, listing.id);
      assert.equal(
        (await marketplace.listFavorites(principal.sub)).items.length,
        0,
      );
      const taxonomy = await marketplace.publicTaxonomy();
      assert.equal(
        taxonomy.categories.some((item) => item.slug === "hidraulica"),
        true,
      );
      const showcase = await marketplace.publicSeller("api");
      assert.equal(showcase.company.verified, true);
      assert.equal(
        showcase.listings[0]?.imageUrl,
        "https://cdn.example.test/bomba.jpg",
      );
      const managed = await marketplace.sellerListings(company.rows[0]!.id);
      assert.equal(managed.items[0]?.status, "PUBLISHED");
      const buyerId = crypto.randomUUID();
      const interest = await marketplace.createInterest(
        { ...principal, sub: buyerId, email: "comprador@example.test" },
        listing.id,
        "Preciso confirmar a aplicação e o prazo.",
      );
      assert.equal(interest.status, "OPEN");
      const received = await marketplace.sellerInterests(company.rows[0]!.id);
      assert.equal(received.items[0]?.buyer.email, "comprador@example.test");
      const proposal = await marketplace.createSellerProposal(
        principal,
        company.rows[0]!.id,
        interest.id,
        { amountMinor: 120000, terms: "Envio em dois dias úteis." },
      );
      assert.equal(proposal.status, "SENT");
      const buyerView = await marketplace.buyerInterests(buyerId);
      assert.equal(buyerView.items[0]?.latestProposal?.amountMinor, 120000);
      const accepted = await marketplace.decideProposal(
        buyerId,
        proposal.id,
        "ACCEPTED",
      );
      assert.equal(accepted.status, "ACCEPTED");
      const review = await marketplace.createReview(
        { ...principal, sub: buyerId, email: "comprador@example.test" },
        proposal.id,
        { rating: 5, comment: "Atendimento rápido e peça correta." },
      );
      assert.equal(review.status, "PUBLISHED");
      const ratedShowcase = await marketplace.publicSeller("api");
      assert.equal(ratedShowcase.company.rating, 5);
      assert.equal(ratedShowcase.company.reviewCount, 1);
      const moderatedCompany = await marketplace.moderateCompany(
        principal,
        application.id,
        "APPROVED",
      );
      assert.equal(moderatedCompany.status, "APPROVED");
      const pendingListing = await marketplace.createListing(application.id, {
        title: "Retentor agrícola",
        description: "Retentor novo disponível para análise administrativa.",
        condition: "NEW",
        stateCode: "SP",
        city: "Campinas",
        priceOnRequest: true,
        imageUrls: [],
      });
      const moderationQueue = await marketplace.adminModeration();
      assert.equal(
        moderationQueue.listings.some((item) => item.id === pendingListing.id),
        true,
      );
      const moderatedListing = await marketplace.moderateListing(
        principal,
        pendingListing.id,
        "PUBLISHED",
      );
      assert.equal(moderatedListing.status, "PUBLISHED");
      const moderationCase = await marketplace.createModerationCase(
        { ...principal, sub: buyerId, email: "comprador@example.test" },
        {
          entityType: "LISTING",
          entityId: listing.id,
          reason: "Informação divergente no anúncio.",
        },
      );
      const queueWithCase = await marketplace.adminModeration();
      assert.equal(
        queueWithCase.cases.some((item) => item.id === moderationCase.id),
        true,
      );
      const resolvedCase = await marketplace.resolveModerationCase(
        principal,
        moderationCase.id,
        "RESOLVED",
        "Anúncio conferido pela equipe.",
      );
      assert.equal(resolvedCase.status, "RESOLVED");
      const onboarding = await pool.query(
        "select event_type,payload from outbox_event where event_type='empresa.cadastro_solicitado'",
      );
      assert.equal(onboarding.rowCount, 1);
      assert.equal(onboarding.rows[0].payload.companyId, application.id);
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
    }
  },
);
