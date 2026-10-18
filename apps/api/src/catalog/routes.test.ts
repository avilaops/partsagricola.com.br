import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../app.ts";

const marketId = "33333333-3333-4333-8333-333333333333";
const partId = "44444444-4444-4444-8444-444444444444";
const modelId = "55555555-5555-4555-8555-555555555555";

function catalogDouble() {
  const calls: Array<{ method: string; input: unknown }> = [];
  return {
    calls,
    repository: {
      listMachineTypes: async () => [
        { id: partId, name: "Trator", slug: "trator" },
      ],
      listBrands: async (input: unknown) => {
        calls.push({ method: "listBrands", input });
        return [
          { id: partId, name: "Massey Ferguson", slug: "massey-ferguson" },
        ];
      },
      listModels: async (input: unknown) => {
        calls.push({ method: "listModels", input });
        return [
          {
            id: modelId,
            name: "MF 290",
            slug: "mf-290",
            yearStart: 1982,
            yearEnd: 2005,
          },
        ];
      },
      listYears: async () => [1982, 1983, 1984],
      listCategories: async () => [
        { id: partId, name: "Hidráulica", slug: "hidraulica", parentId: null },
      ],
      findPartsByCode: async (input: unknown) => {
        calls.push({ method: "findPartsByCode", input });
        return [
          {
            id: partId,
            name: "Bomba hidráulica",
            slug: "bomba-hidraulica",
            description: "Aplicação no sistema hidráulico",
            brand: null,
            category: { id: partId, name: "Hidráulica", slug: "hidraulica" },
            codes: [{ code: "BH-290", kind: "ORIGINAL" }],
            compatibilities: [
              {
                id: partId,
                modelId,
                machineType: "Trator",
                brand: "Massey Ferguson",
                model: "MF 290",
                yearStart: 1982,
                yearEnd: 2005,
              },
            ],
          },
        ];
      },
      listCompatibilities: async () => [],
      search: async (input: Record<string, unknown>) => {
        calls.push({ method: "search", input });
        return {
          data: [
            {
              id: partId,
              listingType: "PART",
              title: "Bomba hidráulica MF 290",
              condition: "RECONDITIONED",
              warrantyMonths: 12,
              stateCode: "SP",
              city: "Ribeirão Preto",
              publishedAt: "2026-10-18T12:00:00.000Z",
              image: null,
              company: { id: partId, name: "Agro Peças", verified: true },
              part: { id: partId, name: "Bomba hidráulica", codes: ["BH-290"] },
              machine: null,
              compatibilities: ["Trator Massey Ferguson MF 290 1982–2005"],
              rating: { average: 4.5, count: 12 },
              price: {
                onRequest: false,
                original: { amountMinor: 125000, currency: "BRL" },
                display: { amountMinor: 25000, currency: "USD" },
                approximate: true,
                rateEffectiveAt: "2026-10-18T10:00:00.000Z",
              },
            },
          ],
          nextCursor: "next-page",
        };
      },
    },
  };
}

function testApp(repository: unknown) {
  return createApp({
    logger: false,
    rateLimitMax: 1000,
    catalog: repository,
    markets: [
      { id: marketId, code: "BR", domains: ["partsagricola.com.br"] },
      {
        id: "66666666-6666-4666-8666-666666666666",
        code: "AR",
        domains: ["partsagricola.com.ar"],
      },
    ],
  } as Parameters<typeof createApp>[0]);
}

test("expõe navegação pública de máquina, categoria, código e compatibilidade", async () => {
  const catalog = catalogDouble();
  const app = await testApp(catalog.repository);
  for (const [url, expected] of [
    ["/v1/catalog/machine-types", "Trator"],
    [`/v1/catalog/brands?machineTypeId=${partId}`, "Massey Ferguson"],
    [`/v1/catalog/models?brandId=${partId}`, "MF 290"],
    [`/v1/catalog/years?modelId=${modelId}`, "1982"],
    ["/v1/catalog/categories", "Hidráulica"],
    ["/v1/catalog/parts/BH-290", "Bomba hidráulica"],
    [`/v1/catalog/compatibilities?partId=${partId}`, '"data"'],
  ] as const) {
    const response = await app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 200, url);
    assert.match(response.body, new RegExp(expected), url);
  }
  assert.equal(
    catalog.calls.find((call) => call.method === "listBrands")?.input,
    partId,
  );
  assert.deepEqual(
    catalog.calls.find((call) => call.method === "findPartsByCode")?.input,
    { code: "BH-290" },
  );
  await app.close();
});

test("busca anônima resolve mercado, normaliza filtros e aceita quatro ordenações", async () => {
  for (const sort of ["RELEVANCE", "PRICE_ASC", "NEWEST", "RATING"] as const) {
    const catalog = catalogDouble();
    const app = await testApp(catalog.repository);
    const response = await app.inject({
      method: "GET",
      url:
        `/v1/catalog/search?q=bomba%20hidraulica%20mf%20290` +
        `&machineTypeId=${partId}&brandId=${partId}&modelId=${modelId}` +
        `&year=1995&categoryId=${partId}&condition=RECONDITIONED` +
        `&state=sp&city=Ribeir%C3%A3o%20Preto&priceMin=10000&priceMax=30000` +
        `&hasWarranty=true&displayCurrency=usd&sort=${sort}&limit=24&cursor=next-page`,
      headers: { host: "partsagricola.com.br" },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().data[0].price.approximate, true);
    assert.equal(response.json().page.nextCursor, "next-page");
    assert.deepEqual(
      catalog.calls.find((call) => call.method === "search")?.input,
      {
        marketId,
        query: "bomba hidraulica mf 290",
        machineTypeId: partId,
        brandId: partId,
        modelId,
        year: 1995,
        categoryId: partId,
        condition: "RECONDITIONED",
        stateCode: "SP",
        city: "Ribeirão Preto",
        priceMin: 10000,
        priceMax: 30000,
        hasWarranty: true,
        displayCurrency: "USD",
        sort,
        limit: 24,
        cursor: "next-page",
      },
    );
    await app.close();
  }
});

test("busca guiada e validação rejeitam filtros inválidos sem consultar o banco", async () => {
  const catalog = catalogDouble();
  const app = await testApp(catalog.repository);
  const guided = await app.inject({
    method: "GET",
    url: `/v1/catalog/search?machineTypeId=${partId}&brandId=${partId}&modelId=${modelId}&year=1990`,
  });
  assert.equal(guided.statusCode, 200);
  const invalid = await app.inject({
    method: "GET",
    url: "/v1/catalog/search?priceMin=300&priceMax=100&limit=101",
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
  assert.equal(
    catalog.calls.filter((call) => call.method === "search").length,
    1,
  );
  await app.close();
});
