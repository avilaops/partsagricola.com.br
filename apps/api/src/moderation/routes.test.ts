import assert from "node:assert/strict";
import test from "node:test";
import type { SessionPrincipal } from "@partsagricola/shared";
import { createApp } from "../app.ts";
import { InMemoryModerationRepository } from "./repository.ts";

const admin: SessionPrincipal = {
  active: true,
  sub: "11111111-1111-4111-8111-111111111111",
  sid: "admin",
  email: "admin@example.test",
  email_verified: true,
  roles: ["ADMIN"],
  seller_ids: [],
  scope: "openid profile",
};
const marketId = "33333333-3333-4333-8333-333333333333";
const flagId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function testApp(
  repository = new InMemoryModerationRepository({
    flags: [
      {
        id: flagId,
        marketId,
        contentType: "MESSAGE",
        contentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        decision: "BLOCK",
        reasons: ["PHONE"],
        source: "SYNC",
        status: "OPEN",
        redactedExcerpt: "[telefone removido]",
        createdAt: "2026-10-18T12:00:00.000Z",
        companyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      },
    ],
  }),
) {
  return createApp({
    logger: false,
    moderation: repository,
    introspect: async (token) =>
      token === "admin"
        ? admin
        : token === "support"
          ? { ...admin, roles: ["SUPPORT"] }
          : token === "user"
            ? { ...admin, roles: ["USER"] }
            : null,
    markets: [{ id: marketId, code: "BR", domains: ["partsagricola.com.br"] }],
  });
}

test("fila rejeita usuário comum e não expõe conteúdo original", async () => {
  const app = await testApp();
  const denied = await app.inject({
    method: "GET",
    url: "/v1/moderation/flags",
    headers: { authorization: "Bearer user" },
  });
  assert.equal(denied.statusCode, 403);
  const listed = await app.inject({
    method: "GET",
    url: "/v1/moderation/flags?status=OPEN",
    headers: { authorization: "Bearer support" },
  });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().data.length, 1);
  assert.doesNotMatch(listed.body, /99999|ciphertext|original/i);
  await app.close();
});

test("suporte confirma ocorrência e aplica sanção progressiva", async () => {
  const repository = new InMemoryModerationRepository({
    flags: [
      {
        id: flagId,
        marketId,
        contentType: "MESSAGE",
        contentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        decision: "BLOCK",
        reasons: ["PHONE"],
        source: "SYNC",
        status: "OPEN",
        redactedExcerpt: "[telefone removido]",
        createdAt: "2026-10-18T12:00:00.000Z",
        companyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      },
    ],
    confirmedCount: 2,
  });
  const app = await testApp(repository);
  const reviewed = await app.inject({
    method: "POST",
    url: `/v1/moderation/flags/${flagId}/review`,
    headers: {
      authorization: "Bearer support",
      "content-type": "application/json",
    },
    payload: { outcome: "CONFIRMED", note: "Contato externo confirmado" },
  });
  assert.equal(reviewed.statusCode, 200);
  assert.equal(reviewed.json().flag.status, "RESOLVED");
  assert.equal(reviewed.json().sanction.kind, "SUSPENSION");
  const repeated = await app.inject({
    method: "POST",
    url: `/v1/moderation/flags/${flagId}/review`,
    headers: {
      authorization: "Bearer support",
      "content-type": "application/json",
    },
    payload: { outcome: "CONFIRMED", note: "Revisão duplicada" },
  });
  assert.equal(repeated.statusCode, 409);
  assert.equal(repeated.json().error.code, "MODERATION_FLAG_ALREADY_REVIEWED");
  await app.close();
});

test("somente ADMIN altera política e histórico aceita empresa ou usuário", async () => {
  const app = await testApp();
  const forbidden = await app.inject({
    method: "PUT",
    url: "/v1/moderation/policy",
    headers: {
      authorization: "Bearer support",
      "content-type": "application/json",
    },
    payload: {
      warningThreshold: 1,
      suspendThreshold: 3,
      blockThreshold: 5,
      suspensionHours: 72,
    },
  });
  assert.equal(forbidden.statusCode, 403);
  const updated = await app.inject({
    method: "PUT",
    url: "/v1/moderation/policy",
    headers: {
      authorization: "Bearer admin",
      "content-type": "application/json",
    },
    payload: {
      warningThreshold: 2,
      suspendThreshold: 4,
      blockThreshold: 6,
      suspensionHours: 48,
    },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().suspensionHours, 48);
  const history = await app.inject({
    method: "GET",
    url: "/v1/moderation/history?companyId=cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    headers: { authorization: "Bearer support" },
  });
  assert.equal(history.statusCode, 200);
  await app.close();
});
