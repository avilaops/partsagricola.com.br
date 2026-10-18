import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient } from "./index.ts";

test("cliente usa contrato tipado, bearer e erro estável", async () => {
  const calls: Array<{
    url: string;
    authorization: string | null;
    method: string;
  }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: input.toString(),
      authorization: headers.get("authorization"),
      method: init?.method ?? "GET",
    });
    return Response.json({
      active: true,
      sub: "u",
      sid: "s",
      email: "a@example.test",
      email_verified: true,
      roles: ["USER"],
      seller_ids: [],
      scope: "openid",
    });
  };
  const session = await createApiClient({
    baseUrl: "https://api.example",
    fetcher,
  }).session("secret-token");
  assert.equal(session.sub, "u");
  assert.deepEqual(calls, [
    {
      url: "https://api.example/v1/session",
      authorization: "Bearer secret-token",
      method: "GET",
    },
  ]);
  const failed = createApiClient({
    baseUrl: "https://api.example",
    fetcher: async () =>
      Response.json(
        {
          error: {
            code: "AUTH_FORBIDDEN",
            message: "negado",
            requestId: "req-1",
          },
        },
        { status: 403 },
      ),
  });
  await assert.rejects(
    failed.session("token"),
    (error: Error & { code?: string; status?: number }) =>
      error.code === "AUTH_FORBIDDEN" && error.status === 403,
  );
});

test("cliente cobre assinatura e conclusão de upload do OpenAPI", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const client = createApiClient({
    baseUrl: "https://api.example",
    fetcher: async (input, init) => {
      calls.push({ url: input.toString(), init });
      return input.toString().endsWith("/sign")
        ? Response.json(
            {
              key: "uploads/seller/image.jpg",
              url: "https://s3",
              expiresIn: 300,
            },
            { status: 201 },
          )
        : Response.json({ jobId: "job-id" }, { status: 202 });
    },
  });
  await client.signUpload("token", "seller-id", {
    fileName: "foto.jpg",
    contentType: "image/jpeg",
    size: 1024,
  });
  await client.completeUpload("token", "seller-id", {
    key: "uploads/seller/image.jpg",
  });

  assert.deepEqual(
    calls.map(({ url, init }) => ({
      url,
      method: init?.method,
      sellerId: new Headers(init?.headers).get("x-seller-id"),
      contentType: new Headers(init?.headers).get("content-type"),
      body: init?.body,
    })),
    [
      {
        url: "https://api.example/v1/uploads/sign",
        method: "POST",
        sellerId: "seller-id",
        contentType: "application/json",
        body: JSON.stringify({
          fileName: "foto.jpg",
          contentType: "image/jpeg",
          size: 1024,
        }),
      },
      {
        url: "https://api.example/v1/uploads/complete",
        method: "POST",
        sellerId: "seller-id",
        contentType: "application/json",
        body: JSON.stringify({ key: "uploads/seller/image.jpg" }),
      },
    ],
  );
});

test("cliente serializa busca pública e referências sem bearer", async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const client = createApiClient({
    baseUrl: "https://api.example",
    fetcher: async (input, init) => {
      calls.push({
        url: input.toString(),
        authorization: new Headers(init?.headers).get("authorization"),
      });
      return Response.json({ data: [], page: { nextCursor: null } });
    },
  });

  await client.searchCatalog({
    q: "bomba hidráulica mf 290",
    condition: "NEW",
    state: "mg",
    hasWarranty: true,
    priceMin: 10000,
    sort: "PRICE_ASC",
    displayCurrency: "brl",
    limit: 12,
  });
  await client.catalogMachineTypes();
  await client.catalogBrands({ machineTypeId: "type-1" });
  await client.catalogModels({ brandId: "brand-1", machineTypeId: "type-1" });
  await client.catalogYears("model-1");
  await client.catalogCategories();
  await client.catalogPartsByCode("MF 290/10");
  await client.catalogCompatibilities("part-1");

  assert.equal(
    calls[0]?.url,
    "https://api.example/v1/catalog/search?q=bomba+hidr%C3%A1ulica+mf+290&condition=NEW&state=mg&hasWarranty=true&priceMin=10000&sort=PRICE_ASC&displayCurrency=brl&limit=12",
  );
  assert.deepEqual(
    calls.slice(1).map(({ url }) => url),
    [
      "https://api.example/v1/catalog/machine-types",
      "https://api.example/v1/catalog/brands?machineTypeId=type-1",
      "https://api.example/v1/catalog/models?brandId=brand-1&machineTypeId=type-1",
      "https://api.example/v1/catalog/years?modelId=model-1",
      "https://api.example/v1/catalog/categories",
      "https://api.example/v1/catalog/parts/MF%20290%2F10",
      "https://api.example/v1/catalog/compatibilities?partId=part-1",
    ],
  );
  assert.ok(calls.every(({ authorization }) => authorization === null));
});

test("cliente administra catálogo e importa CSV com bearer", async () => {
  const calls: Array<{
    url: string;
    method: string;
    body: string | null;
    authorization: string | null;
  }> = [];
  const client = createApiClient({
    baseUrl: "https://api.example",
    fetcher: async (input, init) => {
      calls.push({
        url: input.toString(),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
        authorization: new Headers(init?.headers).get("authorization"),
      });
      return Response.json(
        input.toString().endsWith("/imports")
          ? { rows: 1, parts: 1, codes: 1, fitments: 1, links: 1 }
          : { id: "record-1" },
        { status: init?.method === "POST" ? 201 : 200 },
      );
    },
  });

  await client.listCatalogAdmin("parts", "secret");
  await client.createCatalogAdmin("parts", "secret", {
    name: "Bomba",
    slug: "bomba",
  });
  await client.updateCatalogAdmin("parts", "record-1", "secret", {
    name: "Bomba hidráulica",
  });
  await client.deactivateCatalogAdmin("parts", "record-1", "secret");
  await client.importCatalogCsv("secret", "sku,nome\n1,Bomba");

  assert.deepEqual(
    calls.map(({ url, method }) => ({ url, method })),
    [
      { url: "https://api.example/v1/admin/catalog/parts", method: "GET" },
      { url: "https://api.example/v1/admin/catalog/parts", method: "POST" },
      {
        url: "https://api.example/v1/admin/catalog/parts/record-1",
        method: "PATCH",
      },
      {
        url: "https://api.example/v1/admin/catalog/parts/record-1",
        method: "DELETE",
      },
      { url: "https://api.example/v1/admin/catalog/imports", method: "POST" },
    ],
  );
  assert.equal(
    calls[1]?.body,
    JSON.stringify({ name: "Bomba", slug: "bomba" }),
  );
  assert.equal(calls[4]?.body, JSON.stringify({ csv: "sku,nome\n1,Bomba" }));
  assert.ok(
    calls.every(({ authorization }) => authorization === "Bearer secret"),
  );
});
