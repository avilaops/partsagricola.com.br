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
        tipo: "empresa.cadastro_solicitado",
        chave: "empresa:8cb3b9af:cadastro_solicitado",
        ocorridoEm: "2026-10-17T12:00:00Z",
        correlacaoId: "5e90cc95-7414-4bf8-b394-c51e8d351711",
        ator: {
          id: "0c31fd83-2e2c-4fc4-a7d0-898d18825289",
          tipo: "usuario",
        },
        dados: { empresaId: "8cb3b9af-482f-41ca-a602-ddf05097df49" },
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
            value: expr("{{ $json.body?.id ?? $json.id ?? '' }}"),
            type: "string",
          },
          {
            id: "evento-versao",
            name: "versao",
            value: expr("{{ $json.body?.versao ?? $json.versao ?? 1 }}"),
            type: "number",
          },
          {
            id: "evento-tipo",
            name: "tipo",
            value: expr("{{ $json.body?.tipo ?? $json.tipo ?? '' }}"),
            type: "string",
          },
          {
            id: "evento-chave",
            name: "chave",
            value: expr("{{ $json.body?.chave ?? $json.chave ?? '' }}"),
            type: "string",
          },
          {
            id: "evento-data",
            name: "ocorridoEm",
            value: expr(
              "{{ $json.body?.ocorridoEm ?? $json.ocorridoEm ?? $now.toISO() }}",
            ),
            type: "string",
          },
          {
            id: "evento-correlacao",
            name: "correlacaoId",
            value: expr(
              "{{ $json.body?.correlacaoId ?? $json.correlacaoId ?? $json.body?.id ?? $json.id ?? '' }}",
            ),
            type: "string",
          },
          {
            id: "evento-ator",
            name: "ator",
            value: expr("{{ $json.body?.ator ?? $json.ator ?? {} }}"),
            type: "object",
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
      tipo: "empresa.cadastro_solicitado",
      chave: "empresa:8cb3b9af:cadastro_solicitado",
      ocorridoEm: "2026-10-17T12:00:00Z",
      correlacaoId: "5e90cc95-7414-4bf8-b394-c51e8d351711",
      ator: {
        id: "0c31fd83-2e2c-4fc4-a7d0-898d18825289",
        tipo: "usuario",
      },
      dados: { empresaId: "8cb3b9af-482f-41ca-a602-ddf05097df49" },
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
      tipo: "empresa.cadastro_solicitado",
      chave: "empresa:8cb3b9af:cadastro_solicitado",
      ocorridoEm: "2026-10-17T12:00:00Z",
      correlacaoId: "5e90cc95-7414-4bf8-b394-c51e8d351711",
      dados: { empresaId: "8cb3b9af-482f-41ca-a602-ddf05097df49" },
    },
  ],
});

const rotearEvento = switchCase({
  version: 3.2,
  config: {
    name: "Rotear evento operacional",
    parameters: {
      rules: {
        values: [
          {
            outputKey: "cadastro_empresa",
            conditions: {
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
              },
              conditions: [
                {
                  leftValue: expr("{{ $json.tipo }}"),
                  operator: { type: "string", operation: "equals" },
                  rightValue: "empresa.cadastro_solicitado",
                },
              ],
              combinator: "and",
            },
          },
          {
            outputKey: "empresa_aprovada",
            conditions: {
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
              },
              conditions: [
                {
                  leftValue: expr("{{ $json.tipo }}"),
                  operator: { type: "string", operation: "equals" },
                  rightValue: "empresa.aprovada",
                },
              ],
              combinator: "and",
            },
          },
          {
            outputKey: "moderacao_anuncio",
            conditions: {
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
              },
              conditions: [
                {
                  leftValue: expr("{{ $json.tipo }}"),
                  operator: { type: "string", operation: "equals" },
                  rightValue: "anuncio.moderacao_solicitada",
                },
              ],
              combinator: "and",
            },
          },
          {
            outputKey: "anuncio_publicado",
            conditions: {
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
              },
              conditions: [
                {
                  leftValue: expr("{{ $json.tipo }}"),
                  operator: { type: "string", operation: "equals" },
                  rightValue: "anuncio.publicado",
                },
              ],
              combinator: "and",
            },
          },
          {
            outputKey: "interesse_recebido",
            conditions: {
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
              },
              conditions: [
                {
                  leftValue: expr("{{ $json.tipo }}"),
                  operator: { type: "string", operation: "equals" },
                  rightValue: "interesse.recebido",
                },
              ],
              combinator: "and",
            },
          },
        ],
      },
      options: {
        fallbackOutput: "extra",
        renameFallbackOutput: "Não suportado",
      },
    },
  },
});

const prepararAnaliseEmpresa = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Preparar análise da empresa",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: "acao",
            name: "notificacao.acao",
            value: "analisar_empresa",
            type: "string",
          },
          {
            id: "destino",
            name: "notificacao.destinatarioTipo",
            value: "administracao",
            type: "string",
          },
          {
            id: "entidade",
            name: "notificacao.entidadeId",
            value: expr("{{ $json.dados.empresaId ?? '' }}"),
            type: "string",
          },
          {
            id: "assunto",
            name: "notificacao.assunto",
            value: "Nova empresa aguardando análise",
            type: "string",
          },
          {
            id: "estado",
            name: "processamento.estado",
            value: "preparado",
            type: "string",
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      notificacao: {
        acao: "analisar_empresa",
        destinatarioTipo: "administracao",
        entidadeId: "8cb3b9af-482f-41ca-a602-ddf05097df49",
        assunto: "Nova empresa aguardando análise",
      },
      processamento: { estado: "preparado" },
    },
  ],
});

const prepararEmpresaAprovada = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Preparar confirmação da empresa",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: "acao",
            name: "notificacao.acao",
            value: "confirmar_empresa_aprovada",
            type: "string",
          },
          {
            id: "destino",
            name: "notificacao.destinatarioTipo",
            value: "empresa",
            type: "string",
          },
          {
            id: "entidade",
            name: "notificacao.entidadeId",
            value: expr("{{ $json.dados.empresaId ?? '' }}"),
            type: "string",
          },
          {
            id: "assunto",
            name: "notificacao.assunto",
            value: "Empresa aprovada na PARTSAGRICOLA",
            type: "string",
          },
          {
            id: "estado",
            name: "processamento.estado",
            value: "preparado",
            type: "string",
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      notificacao: {
        acao: "confirmar_empresa_aprovada",
        destinatarioTipo: "empresa",
        entidadeId: "8cb3b9af-482f-41ca-a602-ddf05097df49",
        assunto: "Empresa aprovada na PARTSAGRICOLA",
      },
      processamento: { estado: "preparado" },
    },
  ],
});

const prepararModeracaoAnuncio = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Preparar moderação do anúncio",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: "acao",
            name: "notificacao.acao",
            value: "moderar_anuncio",
            type: "string",
          },
          {
            id: "destino",
            name: "notificacao.destinatarioTipo",
            value: "administracao",
            type: "string",
          },
          {
            id: "entidade",
            name: "notificacao.entidadeId",
            value: expr("{{ $json.dados.anuncioId ?? '' }}"),
            type: "string",
          },
          {
            id: "assunto",
            name: "notificacao.assunto",
            value: "Novo anúncio aguardando moderação",
            type: "string",
          },
          {
            id: "estado",
            name: "processamento.estado",
            value: "preparado",
            type: "string",
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      notificacao: {
        acao: "moderar_anuncio",
        destinatarioTipo: "administracao",
        entidadeId: "0ca1b60c-d10b-4c52-b29e-9c5f659eaee0",
        assunto: "Novo anúncio aguardando moderação",
      },
      processamento: { estado: "preparado" },
    },
  ],
});

const prepararAnuncioPublicado = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Preparar confirmação do anúncio",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: "acao",
            name: "notificacao.acao",
            value: "confirmar_anuncio_publicado",
            type: "string",
          },
          {
            id: "destino",
            name: "notificacao.destinatarioTipo",
            value: "empresa",
            type: "string",
          },
          {
            id: "entidade",
            name: "notificacao.entidadeId",
            value: expr("{{ $json.dados.anuncioId ?? '' }}"),
            type: "string",
          },
          {
            id: "assunto",
            name: "notificacao.assunto",
            value: "Anúncio publicado na PARTSAGRICOLA",
            type: "string",
          },
          {
            id: "estado",
            name: "processamento.estado",
            value: "preparado",
            type: "string",
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      notificacao: {
        acao: "confirmar_anuncio_publicado",
        destinatarioTipo: "empresa",
        entidadeId: "0ca1b60c-d10b-4c52-b29e-9c5f659eaee0",
        assunto: "Anúncio publicado na PARTSAGRICOLA",
      },
      processamento: { estado: "preparado" },
    },
  ],
});

const prepararInteresseRecebido = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Preparar aviso de interesse",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: "acao",
            name: "notificacao.acao",
            value: "avisar_interesse_recebido",
            type: "string",
          },
          {
            id: "destino",
            name: "notificacao.destinatarioTipo",
            value: "empresa_anunciante",
            type: "string",
          },
          {
            id: "entidade",
            name: "notificacao.entidadeId",
            value: expr("{{ $json.dados.interesseId ?? '' }}"),
            type: "string",
          },
          {
            id: "assunto",
            name: "notificacao.assunto",
            value: "Novo interesse em seu anúncio",
            type: "string",
          },
          {
            id: "estado",
            name: "processamento.estado",
            value: "preparado",
            type: "string",
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      notificacao: {
        acao: "avisar_interesse_recebido",
        destinatarioTipo: "empresa_anunciante",
        entidadeId: "b748f81b-f5ca-46a1-af67-6b82d39cc29f",
        assunto: "Novo interesse em seu anúncio",
      },
      processamento: { estado: "preparado" },
    },
  ],
});

const eventoNaoSuportado = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Evento não suportado",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: "estado",
            name: "processamento.estado",
            value: "ignorado",
            type: "string",
          },
          {
            id: "motivo",
            name: "processamento.motivo",
            value: "tipo_evento_nao_suportado",
            type: "string",
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      tipo: "evento.desconhecido",
      processamento: {
        estado: "ignorado",
        motivo: "tipo_evento_nao_suportado",
      },
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
  .to(
    rotearEvento
      .onCase(0, prepararAnaliseEmpresa)
      .onCase(1, prepararEmpresaAprovada)
      .onCase(2, prepararModeracaoAnuncio)
      .onCase(3, prepararAnuncioPublicado)
      .onCase(4, prepararInteresseRecebido)
      .onCase(5, eventoNaoSuportado),
  )
  .group(
    "Recepção idempotente",
    [normalizarEvento, descartarRepetido, rotearEvento],
    {
      description:
        "Normaliza o envelope v1, elimina repetições e encaminha cada evento operacional.",
    },
  );
