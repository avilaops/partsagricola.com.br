import assert from "node:assert/strict";
import test from "node:test";
import type { SessionPrincipal } from "@partsagricola/shared";
import { createApp, type AuditEntry } from "./app.ts";
import type { MarketplaceRepository } from "./marketplace.ts";

const principal: SessionPrincipal = {
  active: true,
  sub: "11111111-1111-4111-8111-111111111111",
  sid: "session-1",
  email: "gestor@example.test",
  email_verified: true,
  roles: ["ADMIN"],
  seller_ids: ["22222222-2222-4222-8222-222222222222"],
  scope: "openid profile",
};

function testApp(overrides: Parameters<typeof createApp>[0] = {}) {
  return createApp({
    logger: false,
    allowedOrigins: ["https://app.partsagricola.com.br"],
    introspect: async (token) => (token === "valid-token" ? principal : null),
    markets: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        code: "BR",
        domains: ["partsagricola.com.br", "app.partsagricola.com.br"],
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        code: "AR",
        domains: ["partsagricola.com.ar"],
      },
    ],
    ...overrides,
  });
}

test("expõe health versionado e OpenAPI 3.1 com todos os domínios", async () => {
  const app = await testApp();
  const health = await app.inject({ method: "GET", url: "/v1/health" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { ok: true, service: "api" });
  const docs = await app.inject({ method: "GET", url: "/v1/docs/" });
  assert.equal(docs.statusCode, 200);
  assert.match(docs.body, /swagger-ui/i);
  const spec = await app.inject({ method: "GET", url: "/v1/openapi.json" });
  assert.equal(spec.statusCode, 200);
  const document = spec.json();
  assert.equal(document.openapi, "3.1.0");
  for (const module of [
    "catalog",
    "sellers",
    "listings",
    "requests",
    "proposals",
    "chat",
    "orders",
    "payments",
    "shipping",
    "reviews",
    "moderation",
    "admin",
    "markets",
  ])
    assert.ok(document.paths[`/v1/${module}`], `${module} ausente no OpenAPI`);
  await app.close();
});

test("padroniza 404 e rejeita cursor inválido sem expor stack", async () => {
  const app = await testApp();
  const missing = await app.inject({ method: "GET", url: "/inexistente" });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, "ROUTE_NOT_FOUND");
  assert.ok(missing.json().error.requestId);
  assert.equal("stack" in missing.json().error, false);
  const invalid = await app.inject({
    method: "GET",
    url: "/v1/catalog?cursor=nao-e-um-cursor",
    headers: { authorization: "Bearer valid-token" },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
  await app.close();
});

test("resolve mercado por parâmetro, header e domínio e bloqueia conflito", async () => {
  const app = await testApp();
  const byHeader = await app.inject({
    method: "GET",
    url: "/v1/catalog",
    headers: { authorization: "Bearer valid-token", "x-market": "AR" },
  });
  assert.equal(byHeader.statusCode, 200);
  assert.equal(byHeader.json().market.code, "AR");
  const byHost = await app.inject({
    method: "GET",
    url: "/v1/catalog",
    headers: {
      authorization: "Bearer valid-token",
      host: "partsagricola.com.ar",
    },
  });
  assert.equal(byHost.json().market.code, "AR");
  const conflict = await app.inject({
    method: "GET",
    url: "/v1/catalog?market=BR",
    headers: { authorization: "Bearer valid-token", "x-market": "AR" },
  });
  assert.equal(conflict.statusCode, 400);
  assert.equal(conflict.json().error.code, "MARKET_CONFLICT");
  await app.close();
});

test("aplica CORS por allowlist e rate limit com erro estável", async () => {
  const app = await testApp({ rateLimitMax: 1 });
  const denied = await app.inject({
    method: "OPTIONS",
    url: "/v1/health",
    headers: {
      origin: "https://malicioso.example",
      "access-control-request-method": "GET",
    },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().error.code, "CORS_ORIGIN_FORBIDDEN");
  await app.inject({ method: "GET", url: "/v1/health" });
  const limited = await app.inject({ method: "GET", url: "/v1/health" });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, "RATE_LIMITED");
  await app.close();
});

test("retorna 401 sem token e 403 estável para papel e seller incorretos", async () => {
  const app = await testApp({
    introspect: async (token) =>
      token === "user-token"
        ? { ...principal, roles: ["USER"], seller_ids: [] }
        : token === "valid-token"
          ? principal
          : null,
  });
  const anonymous = await app.inject({ method: "GET", url: "/v1/orders" });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(anonymous.json().error.code, "AUTH_REQUIRED");
  const global = await app.inject({
    method: "GET",
    url: "/v1/admin",
    headers: { authorization: "Bearer user-token" },
  });
  assert.equal(global.statusCode, 403);
  assert.equal(global.json().error.code, "AUTH_FORBIDDEN");
  const seller = await app.inject({
    method: "GET",
    url: "/v1/listings",
    headers: {
      authorization: "Bearer valid-token",
      "x-seller-id": "55555555-5555-4555-8555-555555555555",
    },
  });
  assert.equal(seller.statusCode, 403);
  assert.equal(seller.json().error.code, "SELLER_SCOPE_FORBIDDEN");
  const sellerMissing = await app.inject({
    method: "GET",
    url: "/v1/listings",
    headers: { authorization: "Bearer valid-token" },
  });
  assert.equal(sellerMissing.statusCode, 403);
  assert.equal(sellerMissing.json().error.code, "SELLER_SCOPE_FORBIDDEN");
  await app.close();
});

test("assina upload validado e audita a ação sensível", async () => {
  const entries: AuditEntry[] = [];
  const queued: string[] = [];
  const app = await testApp({
    audit: { record: async (entry) => void entries.push(entry) },
    uploads: {
      signUpload: async (input) => ({
        key: input.key,
        url: `https://storage.example/${input.key}?signature=test`,
        expiresIn: 300,
      }),
    },
    imageJobs: {
      enqueue: async (input) => {
        queued.push(input.sourceKey);
        return { id: "66666666-6666-4666-8666-666666666666" };
      },
    },
  });
  const response = await app.inject({
    method: "POST",
    url: "/v1/uploads/sign",
    headers: {
      authorization: "Bearer valid-token",
      "x-seller-id": principal.seller_ids[0]!,
      "content-type": "application/json",
    },
    payload: { fileName: "trator.jpg", contentType: "image/jpeg", size: 1024 },
  });
  assert.equal(response.statusCode, 201);
  assert.match(response.json().key, /^uploads\/22222222.*\.jpg$/);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.action, "UPLOAD_SIGNED");
  assert.equal(entries[0]?.sellerId, principal.seller_ids[0]);
  const completed = await app.inject({
    method: "POST",
    url: "/v1/uploads/complete",
    headers: {
      authorization: "Bearer valid-token",
      "x-seller-id": principal.seller_ids[0]!,
      "content-type": "application/json",
    },
    payload: { key: response.json().key },
  });
  assert.equal(completed.statusCode, 202);
  assert.deepEqual(queued, [response.json().key]);
  const invalid = await app.inject({
    method: "POST",
    url: "/v1/uploads/sign",
    headers: {
      authorization: "Bearer valid-token",
      "x-seller-id": principal.seller_ids[0]!,
      "content-type": "application/json",
    },
    payload: { fileName: "ataque.svg", contentType: "image/svg+xml", size: 1 },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
  await app.close();
});

test("cria cadastro de empresa, solicitação e consulta painel", async () => {
  const calls: string[] = [];
  const marketplace: MarketplaceRepository = {
    async createCompanyApplication(_principal, _marketId, input) {
      calls.push(`company:${input.cnpj}`);
      return {
        id: "77777777-7777-4777-8777-777777777777",
        status: "PENDING",
      };
    },
    async createPartRequest(_principal, input) {
      calls.push(`request:${input.title}`);
      return {
        id: "88888888-8888-4888-8888-888888888888",
        status: "OPEN",
      };
    },
    async sellerDashboard(companyId) {
      calls.push(`dashboard:${companyId}`);
      return {
        company: { id: companyId, tradeName: "Agro Teste", status: "APPROVED" },
        metrics: {
          listings: 8,
          publishedListings: 5,
          openInterests: 3,
          openRequests: 2,
        },
      };
    },
    async referenceData() {
      return { categories: [], brands: [] };
    },
  };
  const app = await testApp({ marketplace });
  const headers = {
    authorization: "Bearer valid-token",
    "content-type": "application/json",
  };
  const company = await app.inject({
    method: "POST",
    url: "/v1/sellers/applications",
    headers,
    payload: {
      cnpj: "12.345.678/0001-95",
      legalName: "Agro Teste Ltda",
      tradeName: "Agro Teste",
      email: "contato@agroteste.example",
      stateCode: "SP",
      city: "Ribeirão Preto",
      categoryIds: ["99999999-9999-4999-8999-999999999999"],
      serviceRegions: ["SP", "MG"],
    },
  });
  assert.equal(company.statusCode, 201);
  assert.equal(company.json().status, "PENDING");
  const request = await app.inject({
    method: "POST",
    url: "/v1/requests",
    headers,
    payload: {
      title: "Bomba hidráulica",
      description: "Aplicação em colheitadeira, código ainda não identificado.",
    },
  });
  assert.equal(request.statusCode, 201);
  const dashboard = await app.inject({
    method: "GET",
    url: "/v1/sellers/dashboard",
    headers: {
      authorization: "Bearer valid-token",
      "x-seller-id": principal.seller_ids[0]!,
    },
  });
  assert.equal(dashboard.statusCode, 200);
  assert.equal(dashboard.json().metrics.publishedListings, 5);
  assert.deepEqual(calls, [
    "company:12345678000195",
    "request:Bomba hidráulica",
    `dashboard:${principal.seller_ids[0]}`,
  ]);
  await app.close();
});
