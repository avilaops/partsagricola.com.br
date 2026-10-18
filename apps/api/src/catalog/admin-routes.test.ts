import assert from "node:assert/strict";
import test from "node:test";

import type { SessionPrincipal } from "@partsagricola/shared";
import { createApp, type AuditEntry } from "../app.ts";
import {
  emptyCatalogRepository,
  type CatalogAdminEntity,
} from "./repository.ts";

const principal: SessionPrincipal = {
  active: true,
  sub: "11111111-1111-4111-8111-111111111111",
  sid: "session",
  email: "admin@example.test",
  email_verified: true,
  roles: ["ADMIN"],
  seller_ids: [],
  scope: "openid",
};
const entityId = "22222222-2222-4222-8222-222222222222";

function adminDouble() {
  const calls: Array<{ method: string; input: unknown }> = [];
  return {
    calls,
    repository: {
      ...emptyCatalogRepository,
      listAdmin: async (entity: CatalogAdminEntity) => {
        calls.push({ method: "listAdmin", input: entity });
        return [
          {
            id: entityId,
            name: "Massey Ferguson",
            slug: "massey-ferguson",
            active: true,
          },
        ];
      },
      createAdmin: async (
        entity: CatalogAdminEntity,
        input: Record<string, unknown>,
      ) => {
        calls.push({ method: "createAdmin", input: { entity, input } });
        return { id: entityId, ...(input as object), active: true };
      },
      updateAdmin: async (
        entity: CatalogAdminEntity,
        id: string,
        input: Record<string, unknown>,
      ) => {
        calls.push({ method: "updateAdmin", input: { entity, id, input } });
        return { id, ...(input as object), active: true };
      },
      deactivateAdmin: async (entity: CatalogAdminEntity, id: string) => {
        calls.push({ method: "deactivateAdmin", input: { entity, id } });
        return { id, active: false };
      },
      importCatalogCsv: async (csv: string) => {
        calls.push({ method: "importCatalogCsv", input: csv });
        return { rows: 1, parts: 1, codes: 1, fitments: 1, links: 1 };
      },
    },
  };
}

function testApp(input: {
  roles?: string[];
  catalog: ReturnType<typeof adminDouble>["repository"];
  entries?: AuditEntry[];
}) {
  return createApp({
    logger: false,
    rateLimitMax: 1000,
    introspect: async (token) =>
      token === "valid"
        ? { ...principal, roles: input.roles ?? ["ADMIN"] }
        : null,
    catalog: input.catalog,
    audit: { record: async (entry) => void input.entries?.push(entry) },
    markets: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        code: "BR",
        domains: ["partsagricola.com.br"],
      },
    ],
  });
}

test("admin e suporte executam CRUD auditado de todas as entidades", async () => {
  for (const roles of [["ADMIN"], ["SUPPORT"]]) {
    const catalog = adminDouble();
    const entries: AuditEntry[] = [];
    const app = await testApp({ roles, catalog: catalog.repository, entries });
    const headers = {
      authorization: "Bearer valid",
      "content-type": "application/json",
    };
    const listed = await app.inject({
      method: "GET",
      url: "/v1/admin/catalog/brands",
      headers,
    });
    assert.equal(listed.statusCode, 200);
    const created = await app.inject({
      method: "POST",
      url: "/v1/admin/catalog/brands",
      headers,
      payload: { name: "Massey Ferguson", slug: "massey-ferguson" },
    });
    assert.equal(created.statusCode, 201, created.body);
    const updated = await app.inject({
      method: "PATCH",
      url: `/v1/admin/catalog/brands/${entityId}`,
      headers,
      payload: { name: "Massey Ferguson Brasil" },
    });
    assert.equal(updated.statusCode, 200, updated.body);
    const removed = await app.inject({
      method: "DELETE",
      url: `/v1/admin/catalog/brands/${entityId}`,
      headers: { authorization: "Bearer valid" },
    });
    assert.equal(removed.statusCode, 200, removed.body);
    assert.deepEqual(
      entries.map((entry) => entry.action),
      ["CATALOG_CREATED", "CATALOG_UPDATED", "CATALOG_DEACTIVATED"],
    );
    assert.ok(entries.every((entry) => entry.entityType === "catalog_brand"));
    await app.close();
  }
});

test("rejeita mutação anônima, USER e FINANCE antes do repositório", async () => {
  for (const roles of [undefined, ["USER"], ["FINANCE"]]) {
    const catalog = adminDouble();
    const app = await testApp({
      roles: roles ?? [],
      catalog: catalog.repository,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/catalog/machine-types",
      ...(roles
        ? {
            headers: {
              authorization: "Bearer valid",
              "content-type": "application/json",
            },
          }
        : {}),
      payload: { name: "Trator", slug: "trator" },
    });
    assert.equal(response.statusCode, roles ? 403 : 401);
    assert.equal(catalog.calls.length, 0);
    await app.close();
  }
});

test("importa CSV validado e audita somente após sucesso", async () => {
  const csv =
    "schema_version,source,external_id,part_name,part_code,code_type,brand,category,description,machine_type,machine_brand,machine_model,year_start,year_end\n1,teste,1,Bomba,BH-1,ORIGINAL,,Hidráulica,,,,,,";
  const catalog = adminDouble();
  const entries: AuditEntry[] = [];
  const app = await testApp({ catalog: catalog.repository, entries });
  const response = await app.inject({
    method: "POST",
    url: "/v1/admin/catalog/imports",
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload: { csv },
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.deepEqual(response.json(), {
    rows: 1,
    parts: 1,
    codes: 1,
    fitments: 1,
    links: 1,
  });
  assert.equal(entries[0]!.action, "CATALOG_IMPORTED");
  const invalid = await app.inject({
    method: "POST",
    url: "/v1/admin/catalog/imports",
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload: { csv: "curto" },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(entries.length, 1);
  await app.close();
});

test("valida entidade e corpo antes de criar referência", async () => {
  const catalog = adminDouble();
  const app = await testApp({ catalog: catalog.repository });
  const headers = {
    authorization: "Bearer valid",
    "content-type": "application/json",
  };
  const unknown = await app.inject({
    method: "POST",
    url: "/v1/admin/catalog/desconhecido",
    headers,
    payload: { name: "X", slug: "x" },
  });
  assert.equal(unknown.statusCode, 400);
  const malformed = await app.inject({
    method: "POST",
    url: "/v1/admin/catalog/brands",
    headers,
    payload: { name: "", slug: "INVALIDO COM ESPAÇO" },
  });
  assert.equal(malformed.statusCode, 400);
  assert.equal(catalog.calls.length, 0);
  await app.close();
});
