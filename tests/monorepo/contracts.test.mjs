import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createHealthPayload } from "../../packages/shared/src/index.ts";

test("health payload identifica serviço e estado", () => {
  assert.deepEqual(createHealthPayload("api"), { ok: true, service: "api" });
});

test("rejeita nome de serviço vazio", () => {
  assert.throws(() => createHealthPayload(""), /service/);
});

test("shell usa configuração de marca e landmarks acessíveis", async () => {
  const shell = await readFile(
    new URL("../../packages/ui/src/index.tsx", import.meta.url),
    "utf8",
  );

  assert.match(shell, /BRAND\.name/);
  assert.match(shell, /<header className="app-header">/);
  assert.match(shell, /<main id="conteudo"/);
  assert.match(shell, /tabIndex=\{-1\}/);
});

test("workflow operacional cobre o ciclo B2B sem eventos de ecommerce", async () => {
  const workflow = await readFile(
    new URL("../../n8n/partsagricola-operacao.ts", import.meta.url),
    "utf8",
  );

  for (const eventType of [
    "empresa.cadastro_solicitado",
    "empresa.aprovada",
    "anuncio.moderacao_solicitada",
    "anuncio.publicado",
    "interesse.recebido",
  ]) {
    assert.match(workflow, new RegExp(eventType.replace(".", "\\.")));
  }

  assert.doesNotMatch(workflow, /pedido\.criado/);
  assert.doesNotMatch(workflow, /pagamento\.atualizado/);
  assert.doesNotMatch(workflow, /envio\.atualizado/);
  assert.match(workflow, /Rotear evento operacional/);
  assert.match(workflow, /Evento não suportado/);
});
