import assert from "node:assert/strict";
import test from "node:test";
import type { SessionPrincipal } from "@partsagricola/shared";
import { createApp } from "../app.ts";
import { InMemoryChatRepository } from "./repository.ts";
import WebSocket from "ws";

const userId = "11111111-1111-4111-8111-111111111111";
const outsiderId = "99999999-9999-4999-8999-999999999999";
const conversationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const messageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const marketId = "33333333-3333-4333-8333-333333333333";
const principal: SessionPrincipal = {
  active: true,
  sub: userId,
  sid: "session-1",
  email: "comprador@example.test",
  email_verified: true,
  roles: ["USER"],
  seller_ids: [],
  scope: "openid profile",
};

function appWith(repository: InMemoryChatRepository, withUploads = false) {
  return createApp({
    logger: false,
    chat: repository,
    allowedOrigins: ["https://partsagricola.com.br"],
    introspect: async (token) =>
      token === "valid"
        ? principal
        : token === "outsider"
          ? { ...principal, sub: outsiderId }
          : null,
    markets: [{ id: marketId, code: "BR", domains: ["partsagricola.com.br"] }],
    ...(withUploads
      ? {
          uploads: {
            async signUpload(input: {
              key: string;
              contentType: string;
              size: number;
            }) {
              return {
                key: input.key,
                url: "https://storage.example.test/signed",
                expiresIn: 300,
              };
            },
          },
        }
      : {}),
  });
}

function repository() {
  return new InMemoryChatRepository({
    conversations: [
      {
        id: conversationId,
        marketId,
        contextType: "LISTING",
        contextId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        title: "Bomba hidráulica MF 290",
        participantIds: [userId],
        updatedAt: "2026-10-18T12:00:00.000Z",
      },
    ],
  });
}

test("lista somente conversas do participante e pagina mensagens", async () => {
  const repo = repository();
  const app = await appWith(repo);
  const listed = await app.inject({
    method: "GET",
    url: "/v1/chat/conversations",
    headers: { authorization: "Bearer valid" },
  });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().data[0].id, conversationId);
  const outsider = await app.inject({
    method: "GET",
    url: `/v1/chat/conversations/${conversationId}/messages`,
    headers: { authorization: "Bearer outsider" },
  });
  assert.equal(outsider.statusCode, 404);
  assert.equal(outsider.json().error.code, "CONVERSATION_NOT_FOUND");
  await app.close();
});

test("envia mensagem idempotente, mascara contato e marca leitura", async () => {
  const repo = repository();
  const app = await appWith(repo);
  const payload = {
    clientMessageId: messageId,
    body: "WhatsApp (11) 99999-8877",
    attachments: [],
  };
  const first = await app.inject({
    method: "POST",
    url: `/v1/chat/conversations/${conversationId}/messages`,
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload,
  });
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().moderationStatus, "BLOCK");
  assert.doesNotMatch(first.body, /99999/);
  const repeated = await app.inject({
    method: "POST",
    url: `/v1/chat/conversations/${conversationId}/messages`,
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload,
  });
  assert.equal(repeated.statusCode, 200);
  assert.equal(repeated.json().id, first.json().id);
  const read = await app.inject({
    method: "POST",
    url: `/v1/chat/conversations/${conversationId}/read`,
    headers: { authorization: "Bearer valid" },
  });
  assert.equal(read.statusCode, 204);
  await app.close();
});

test("anexo entra em quarentena e denúncia é idempotente", async () => {
  const repo = repository();
  const app = await appWith(repo);
  const sent = await app.inject({
    method: "POST",
    url: `/v1/chat/conversations/${conversationId}/messages`,
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload: {
      clientMessageId: messageId,
      body: "Foto da aplicação",
      attachments: [
        {
          storageKey: `uploads/${userId}/foto.jpg`,
          mimeType: "image/jpeg",
        },
      ],
    },
  });
  assert.equal(sent.statusCode, 201);
  assert.equal(sent.json().attachments[0].status, "QUARANTINED");
  assert.equal("url" in sent.json().attachments[0], false);
  const reportPayload = {
    targetType: "MESSAGE",
    targetId: sent.json().id,
    reason: "CONTACT_ATTEMPT",
  };
  const report = await app.inject({
    method: "POST",
    url: "/v1/chat/reports",
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload: reportPayload,
  });
  assert.equal(report.statusCode, 201);
  const duplicate = await app.inject({
    method: "POST",
    url: "/v1/chat/reports",
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload: reportPayload,
  });
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.json().id, report.json().id);
  await app.close();
});

test("assina foto para o participante e rejeita chave de outro usuário", async () => {
  const app = await appWith(repository(), true);
  const signed = await app.inject({
    method: "POST",
    url: "/v1/chat/uploads/sign",
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload: {
      fileName: "aplicacao.jpg",
      contentType: "image/jpeg",
      size: 1024,
    },
  });
  assert.equal(signed.statusCode, 201);
  assert.match(signed.json().key, new RegExp(`^uploads/${userId}/`));
  const foreign = await app.inject({
    method: "POST",
    url: `/v1/chat/conversations/${conversationId}/messages`,
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload: {
      clientMessageId: crypto.randomUUID(),
      body: "Foto",
      attachments: [
        {
          storageKey: `uploads/${outsiderId}/${crypto.randomUUID()}.jpg`,
          mimeType: "image/jpeg",
        },
      ],
    },
  });
  assert.equal(foreign.statusCode, 403);
  assert.equal(foreign.json().error.code, "CHAT_ATTACHMENT_FORBIDDEN");
  await app.close();
});

test("WebSocket autenticado recebe mensagem e HTTP permanece como fallback", async () => {
  const repo = repository();
  const app = await appWith(repo);
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address !== "string");
  const ticketResponse = await app.inject({
    method: "POST",
    url: `/v1/chat/conversations/${conversationId}/realtime-ticket`,
    headers: { authorization: "Bearer valid" },
  });
  assert.equal(ticketResponse.statusCode, 201);
  const socket = new WebSocket(
    `ws://127.0.0.1:${address.port}/v1/chat/conversations/${conversationId}/events?ticket=${ticketResponse.json().ticket}`,
  );
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const event = new Promise<Record<string, unknown>>((resolve, reject) => {
    socket.once("message", (value) => resolve(JSON.parse(value.toString())));
    socket.once("error", reject);
  });
  const response = await app.inject({
    method: "POST",
    url: `/v1/chat/conversations/${conversationId}/messages`,
    headers: {
      authorization: "Bearer valid",
      "content-type": "application/json",
    },
    payload: {
      clientMessageId: messageId,
      body: "Mensagem interna",
      attachments: [],
    },
  });
  assert.equal(response.statusCode, 201);
  assert.equal((await event).type, "message.created");
  const fallback = await app.inject({
    method: "GET",
    url: `/v1/chat/conversations/${conversationId}/messages`,
    headers: { authorization: "Bearer valid" },
  });
  assert.equal(fallback.statusCode, 200);
  assert.equal(fallback.json().data.length, 1);
  socket.close();
  await app.close();
});
