import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createHttpOcrProvider,
  createHttpTextModerator,
  processNextModeration,
  type ModerationJob,
  type ModerationJobStore,
} from "./moderation.ts";

function storeFor(job: ModerationJob | null) {
  const events: Array<Record<string, unknown>> = [];
  const store: ModerationJobStore = {
    claim: async () => job,
    complete: async (id, result) =>
      void events.push({ type: "complete", id, ...result }),
    requireReview: async (id, reason) =>
      void events.push({ type: "review", id, reason }),
    fail: async (id, error) => void events.push({ type: "fail", id, error }),
    purgeExpiredEvidence: async () => 0,
  };
  return { store, events };
}

test("texto assíncrono eleva ALLOW para MASK e apaga evidência", async () => {
  const { store, events } = storeFor({
    id: "job-1",
    contentType: "MESSAGE_TEXT",
    contentId: "message-1",
    currentDecision: "ALLOW",
    evidence: {
      ciphertext: Buffer.from("cipher"),
      iv: Buffer.alloc(12),
      authTag: Buffer.alloc(16),
      sha256: "a".repeat(64),
      keyVersion: 1,
    },
  });
  const processed = await processNextModeration(store, {
    decryptEvidence: () => "me chama fora da plataforma",
    analyzeText: async () => ({ decision: "MASK", reasons: ["OFF_PLATFORM"] }),
    extractImageText: async () => null,
  });
  assert.equal(processed, true);
  assert.deepEqual(events, [
    {
      type: "complete",
      id: "job-1",
      decision: "MASK",
      reasons: ["OFF_PLATFORM"],
      purgeEvidence: true,
    },
  ]);
});

test("análise nunca reduz BLOCK e OCR ausente exige revisão", async () => {
  const text = storeFor({
    id: "job-2",
    contentType: "MESSAGE_TEXT",
    contentId: "message-2",
    currentDecision: "BLOCK",
    evidence: {
      ciphertext: Buffer.from("cipher"),
      iv: Buffer.alloc(12),
      authTag: Buffer.alloc(16),
      sha256: "b".repeat(64),
      keyVersion: 1,
    },
  });
  await processNextModeration(text.store, {
    decryptEvidence: () => "texto",
    analyzeText: async () => ({ decision: "ALLOW", reasons: [] }),
    extractImageText: async () => null,
  });
  assert.equal(text.events[0]!.decision, "BLOCK");

  const image = storeFor({
    id: "job-3",
    contentType: "MESSAGE_IMAGE",
    contentId: "message-3",
    currentDecision: "ALLOW",
    storageKey: "uploads/company/photo.jpg",
  });
  await processNextModeration(image.store, {
    decryptEvidence: () => "",
    analyzeText: async () => ({ decision: "ALLOW", reasons: [] }),
    extractImageText: async () => null,
  });
  assert.deepEqual(image.events, [
    { type: "review", id: "job-3", reason: "OCR_UNAVAILABLE" },
  ]);
});

test("falha do provedor agenda retentativa sem concluir", async () => {
  const { store, events } = storeFor({
    id: "job-4",
    contentType: "MESSAGE_TEXT",
    contentId: "message-4",
    currentDecision: "ALLOW",
    evidence: {
      ciphertext: Buffer.from("cipher"),
      iv: Buffer.alloc(12),
      authTag: Buffer.alloc(16),
      sha256: "c".repeat(64),
      keyVersion: 1,
    },
  });
  await assert.rejects(
    processNextModeration(store, {
      decryptEvidence: () => "texto",
      analyzeText: async () => {
        throw new Error("provider unavailable");
      },
      extractImageText: async () => null,
    }),
    /provider unavailable/,
  );
  assert.deepEqual(events, [
    { type: "fail", id: "job-4", error: "provider unavailable" },
  ]);
});

test("adaptadores HTTP validam contrato de IA e OCR sem expor segredo", async () => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
    });
    return new Response(
      JSON.stringify(
        String(input).includes("ocr")
          ? { text: "telefone na imagem" }
          : { decision: "BLOCK", reasons: ["PHONE"] },
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const moderate = createHttpTextModerator(
    { endpoint: "https://provider.test/moderate", apiKey: "secret" },
    fetcher,
  );
  const ocr = createHttpOcrProvider(
    { endpoint: "https://provider.test/ocr", apiKey: "secret" },
    fetcher,
  );
  assert.deepEqual(await moderate("texto"), {
    decision: "BLOCK",
    reasons: ["PHONE"],
  });
  assert.equal(await ocr("uploads/company/photo.jpg"), "telefone na imagem");
  assert.deepEqual(
    requests.map((request) => request.authorization),
    ["Bearer secret", "Bearer secret"],
  );
});

test("job assíncrono deduplica o incidente mesmo após revisão síncrona", async () => {
  const source = await readFile(
    new URL("./moderation.ts", import.meta.url),
    "utf8",
  );
  const update = source.match(
    /update marketplace\.moderation_flag set[\s\S]*?where id=\(select id[\s\S]*?order by created_at limit 1\)/,
  );
  assert.ok(update, "worker precisa enriquecer a flag do mesmo incidente");
  assert.doesNotMatch(update[0], /status='OPEN'/);
  assert.match(update[0], /content_type='MESSAGE' and content_id=\$1/);
});
