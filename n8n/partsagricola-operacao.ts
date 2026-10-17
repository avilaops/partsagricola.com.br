const receberEvento = trigger({
  type: "n8n-nodes-base.webhook",
  version: 2.2,
  config: {
    name: "Receber evento da PARTSAGRICOLA",
    parameters: {
      httpMethod: "POST",
      path: "partsagricola-eventos",
      authentication: "headerAuth",
      responseMode: "onReceived",
      options: {},
    },
    credentials: {
      httpHeaderAuth: newCredential("PARTSAGRICOLA - entrada de eventos"),
    },
  },
  output: [
    {
      body: {
        id: "e845f3fd-4d2f-46f1-b8a7-df35bf36e1aa",
        versao: 1,
        tipo: "fornecedor.cadastro_solicitado",
        chave: "fornecedor:8cb3b9af:cadastro_solicitado",
        ocorridoEm: "2026-10-17T12:00:00Z",
        correlacaoId: "5e90cc95-7414-4bf8-b394-c51e8d351711",
        dados: { fornecedorId: "8cb3b9af-482f-41ca-a602-ddf05097df49" },
      },
    },
  ],
});

const normalizarEvento = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Normalizar evento",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [
          {
            id: "evento-id",
            name: "id",
            value: expr("{{ $json.body?.id ?? $json.id }}"),
            type: "string",
          },
          {
            id: "evento-versao",
            name: "versao",
            value: expr("{{ $json.body?.versao ?? $json.versao }}"),
            type: "number",
          },
          {
            id: "evento-tipo",
            name: "tipo",
            value: expr("{{ $json.body?.tipo ?? $json.tipo }}"),
            type: "string",
          },
          {
            id: "evento-chave",
            name: "chave",
            value: expr("{{ $json.body?.chave ?? $json.chave }}"),
            type: "string",
          },
          {
            id: "evento-data",
            name: "ocorridoEm",
            value: expr("{{ $json.body?.ocorridoEm ?? $json.ocorridoEm }}"),
            type: "string",
          },
          {
            id: "evento-correlacao",
            name: "correlacaoId",
            value: expr("{{ $json.body?.correlacaoId ?? $json.correlacaoId }}"),
            type: "string",
          },
          {
            id: "evento-dados",
            name: "dados",
            value: expr("{{ $json.body?.dados ?? $json.dados ?? {} }}"),
            type: "object",
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      id: "e845f3fd-4d2f-46f1-b8a7-df35bf36e1aa",
      versao: 1,
      tipo: "fornecedor.cadastro_solicitado",
      chave: "fornecedor:8cb3b9af:cadastro_solicitado",
      ocorridoEm: "2026-10-17T12:00:00Z",
      correlacaoId: "5e90cc95-7414-4bf8-b394-c51e8d351711",
      dados: { fornecedorId: "8cb3b9af-482f-41ca-a602-ddf05097df49" },
    },
  ],
});

const descartarRepetido = node({
  type: "n8n-nodes-base.removeDuplicates",
  version: 2,
  config: {
    name: "Descartar evento repetido",
    parameters: {
      operation: "removeItemsSeenInPreviousExecutions",
      logic: "removeItemsWithAlreadySeenKeyValues",
      dedupeValue: expr("{{ $json.id }}"),
      options: { scope: "node", historySize: 10000 },
    },
  },
  output: [
    {
      id: "e845f3fd-4d2f-46f1-b8a7-df35bf36e1aa",
      versao: 1,
      tipo: "fornecedor.cadastro_solicitado",
      chave: "fornecedor:8cb3b9af:cadastro_solicitado",
      ocorridoEm: "2026-10-17T12:00:00Z",
      correlacaoId: "5e90cc95-7414-4bf8-b394-c51e8d351711",
      dados: { fornecedorId: "8cb3b9af-482f-41ca-a602-ddf05097df49" },
    },
  ],
});

const registrarRecebimento = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Registrar recebimento",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: "recebido", name: "recebido", value: true, type: "boolean" },
          {
            id: "recebido-em",
            name: "recebidoEm",
            value: expr("{{ $now.toISO() }}"),
            type: "string",
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      id: "e845f3fd-4d2f-46f1-b8a7-df35bf36e1aa",
      recebido: true,
      recebidoEm: "2026-10-17T12:00:01.000Z",
    },
  ],
});

export default workflow(
  "partsagricola-operacao",
  "[Marketplace] Operação — PARTSAGRICOLA",
)
  .add(receberEvento)
  .to(normalizarEvento)
  .to(descartarRepetido)
  .to(registrarRecebimento)
  .group(
    "Recepção idempotente",
    [normalizarEvento, descartarRepetido, registrarRecebimento],
    {
      description:
        "Normaliza o envelope v1 e impede que um mesmo evento seja processado duas vezes.",
    },
  );
