import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeEvent,
  prepareOperation,
  validateEvent,
} from "../../n8n/partsagricola-operacao-contract.mjs";
import { createHealthPayload } from "../../packages/shared/src/index.ts";

const ids = {
  evento: "e845f3fd-4d2f-46f1-b8a7-df35bf36e1aa",
  correlacao: "5e90cc95-7414-4bf8-b394-c51e8d351711",
  empresa: "8cb3b9af-482f-41ca-a602-ddf05097df49",
  anuncio: "0ca1b60c-d10b-4c52-b29e-9c5f659eaee0",
  interesse: "b748f81b-f5ca-46a1-af67-6b82d39cc29f",
};

function validEvent(overrides = {}) {
  return {
    id: ids.evento,
    versao: 1,
    tipo: "empresa.cadastro_solicitado",
    chave: "empresa:cadastro_solicitado",
    ocorridoEm: "2026-10-17T12:00:00Z",
    correlacaoId: ids.correlacao,
    ator: {},
    dados: { empresaId: ids.empresa },
    ...overrides,
  };
}

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
  assert.match(shell, /<header className="pa-market-header">/);
  assert.match(shell, /role="search"/);
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
  assert.match(workflow, /Validar contrato do evento/);
  assert.match(workflow, /Rejeitar evento inválido/);
  assert.match(workflow, /Verificar evento ainda não processado/);
  assert.match(workflow, /Registrar evento processado/);
  assert.match(workflow, /partsagricola_eventos_processados/);
  assert.equal(workflow.match(/notificacao\.destinatarioId/g)?.length, 5);
  assert.equal(workflow.match(/notificacao\.mensagem/g)?.length, 5);
  assert.match(workflow, /empresaAnuncianteId/);
  assert.match(workflow, /evento_v1_invalido/);
  assert.doesNotMatch(workflow, /removeItemsSeenInPreviousExecutions/);
});

test("normalização aceita envelope webhook e não inventa campos obrigatórios", () => {
  assert.deepEqual(normalizeEvent({ body: validEvent() }), validEvent());

  const normalized = normalizeEvent({ body: { tipo: "empresa.aprovada" } });
  assert.equal(normalized.versao, 0);
  assert.equal(normalized.ocorridoEm, "");
  assert.equal(normalized.correlacaoId, "");
});

test("contrato rejeita cada campo básico obrigatório ausente", () => {
  for (const field of [
    "id",
    "versao",
    "tipo",
    "chave",
    "ocorridoEm",
    "correlacaoId",
  ]) {
    const event = validEvent();
    delete event[field];
    assert.equal(
      validateEvent(normalizeEvent(event)).valida,
      false,
      `deveria rejeitar evento sem ${field}`,
    );
  }

  assert.equal(validateEvent(validEvent({ versao: 2 })).valida, false);
  assert.equal(
    validateEvent(validEvent({ ocorridoEm: "data-invalida" })).valida,
    false,
  );
});

test("contrato exige identificadores das entidades por tipo de evento", () => {
  const scenarios = [
    ["empresa.cadastro_solicitado", { empresaId: ids.empresa }],
    ["empresa.aprovada", { empresaId: ids.empresa }],
    [
      "anuncio.moderacao_solicitada",
      { anuncioId: ids.anuncio, empresaId: ids.empresa },
    ],
    ["anuncio.publicado", { anuncioId: ids.anuncio, empresaId: ids.empresa }],
    [
      "interesse.recebido",
      {
        interesseId: ids.interesse,
        anuncioId: ids.anuncio,
        empresaAnuncianteId: ids.empresa,
      },
    ],
  ];

  for (const [tipo, dados] of scenarios) {
    assert.equal(validateEvent(validEvent({ tipo, dados })).valida, true, tipo);
    for (const field of Object.keys(dados)) {
      assert.equal(
        validateEvent(validEvent({ tipo, dados: { ...dados, [field]: "" } }))
          .valida,
        false,
        `${tipo} deveria exigir ${field}`,
      );
    }
  }
});

test("roteamento prepara destinatário e mensagem das cinco operações", () => {
  const scenarios = [
    ["empresa.cadastro_solicitado", "administracao", ids.empresa],
    ["empresa.aprovada", ids.empresa, ids.empresa],
    ["anuncio.moderacao_solicitada", "administracao", ids.anuncio],
    ["anuncio.publicado", ids.empresa, ids.anuncio],
    ["interesse.recebido", ids.empresa, ids.interesse],
  ];
  const dados = {
    empresaId: ids.empresa,
    empresaAnuncianteId: ids.empresa,
    anuncioId: ids.anuncio,
    interesseId: ids.interesse,
  };

  for (const [tipo, destinatarioId, entidadeId] of scenarios) {
    const result = prepareOperation(validEvent({ tipo, dados }));
    assert.equal(result.processamento.estado, "preparado");
    assert.equal(result.notificacao.destinatarioId, destinatarioId);
    assert.equal(result.notificacao.entidadeId, entidadeId);
    assert.ok(result.notificacao.mensagem.length > 20);
  }

  assert.deepEqual(
    prepareOperation(validEvent({ tipo: "evento.desconhecido" })),
    {
      processamento: {
        estado: "ignorado",
        motivo: "tipo_evento_nao_suportado",
      },
    },
  );
});

test("evidências do workflow registram homologação desktop e mobile", async () => {
  const evidenceUrl = new URL("../../docs/evidencias/", import.meta.url);
  const html = await readFile(
    new URL("n8n-fluxo-operacional.html", evidenceUrl),
    "utf8",
  );
  const desktop = await readFile(
    new URL("n8n-fluxo-operacional.png", evidenceUrl),
  );
  const mobile = await readFile(
    new URL("n8n-fluxo-operacional-mobile.png", evidenceUrl),
  );

  assert.match(html, /t2rlskN2x1OYthGF/);
  assert.match(html, /94000/);
  assert.match(html, /94007/);
  assert.match(html, /94009/);
  assert.deepEqual(desktop.subarray(1, 4).toString(), "PNG");
  assert.deepEqual(mobile.subarray(1, 4).toString(), "PNG");
  assert.ok(desktop.length > 50_000);
  assert.ok(mobile.length > 50_000);
});
