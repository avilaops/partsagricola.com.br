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
            value: expr("{{ $json.body?.versao ?? $json.versao ?? 0 }}"),
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
              "{{ $json.body?.ocorridoEm ?? $json.ocorridoEm ?? '' }}",
            ),
            type: "string",
          },
          {
            id: "evento-correlacao",
            name: "correlacaoId",
            value: expr(
              "{{ $json.body?.correlacaoId ?? $json.correlacaoId ?? '' }}",
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

const validarContrato = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Validar contrato do evento",
    parameters: {
      mode: "runOnceForEachItem",
      language: "javaScript",
      jsCode:
        "const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\n" +
        "const data = $json.dados ?? {};\n" +
        "const required = {\n" +
        "  'empresa.cadastro_solicitado': ['empresaId'],\n" +
        "  'empresa.aprovada': ['empresaId'],\n" +
        "  'anuncio.moderacao_solicitada': ['anuncioId', 'empresaId'],\n" +
        "  'anuncio.publicado': ['anuncioId', 'empresaId'],\n" +
        "  'interesse.recebido': ['interesseId', 'anuncioId', 'empresaAnuncianteId'],\n" +
        "};\n" +
        "const baseValid = uuid.test($json.id) && $json.versao === 1 && typeof $json.tipo === 'string' && $json.tipo.length > 0 && typeof $json.chave === 'string' && $json.chave.length > 0 && uuid.test($json.correlacaoId) && !Number.isNaN(Date.parse($json.ocorridoEm));\n" +
        "const entityValid = (required[$json.tipo] ?? []).every((field) => uuid.test(data[field]));\n" +
        "const valid = baseValid && entityValid;\n" +
        "return { json: { ...$json, validacao: { valida: valid, erro: valid ? null : 'evento_v1_invalido' } } };",
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
      validacao: { valida: true, erro: null },
    },
  ],
});

const contratoValido = ifElse({
  version: 2.3,
  config: {
    name: "Contrato válido?",
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: "",
          typeValidation: "strict",
          version: 2,
        },
        conditions: [
          {
            leftValue: expr("{{ $json.validacao.valida }}"),
            operator: { type: "boolean", operation: "true", singleValue: true },
            rightValue: "",
          },
        ],
        combinator: "and",
      },
      options: {},
    },
  },
});

const eventoInvalido = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Rejeitar evento inválido",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: "estado",
            name: "processamento.estado",
            value: "rejeitado",
            type: "string",
          },
          {
            id: "motivo",
            name: "processamento.motivo",
            value: "evento_v1_invalido",
            type: "string",
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      tipo: "empresa.aprovada",
      validacao: { valida: false, erro: "evento_v1_invalido" },
      processamento: { estado: "rejeitado", motivo: "evento_v1_invalido" },
    },
  ],
});

const verificarEventoInedito = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Verificar evento ainda não processado",
    parameters: {
      resource: "row",
      operation: "rowNotExists",
      dataTableId: {
        __rl: true,
        mode: "id",
        value: "wIdWMl1CgbQYxtZ1",
        cachedResultName: "partsagricola_eventos_processados",
      },
      matchType: "anyCondition",
      filters: {
        conditions: [
          {
            keyName: "event_id",
            condition: "eq",
            keyValue: expr("{{ $json.id }}"),
          },
        ],
      },
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
      validacao: { valida: true, erro: null },
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
            id: "destino-id",
            name: "notificacao.destinatarioId",
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
            id: "mensagem",
            name: "notificacao.mensagem",
            value: expr(
              "A empresa {{ $json.dados.empresaId }} solicitou cadastro e aguarda análise.",
            ),
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
        destinatarioId: "administracao",
        entidadeId: "8cb3b9af-482f-41ca-a602-ddf05097df49",
        assunto: "Nova empresa aguardando análise",
        mensagem:
          "A empresa 8cb3b9af-482f-41ca-a602-ddf05097df49 solicitou cadastro e aguarda análise.",
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
            id: "destino-id",
            name: "notificacao.destinatarioId",
            value: expr("{{ $json.dados.empresaId }}"),
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
            id: "mensagem",
            name: "notificacao.mensagem",
            value:
              "Sua empresa foi aprovada e já pode operar na PARTSAGRICOLA.",
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
        destinatarioId: "8cb3b9af-482f-41ca-a602-ddf05097df49",
        entidadeId: "8cb3b9af-482f-41ca-a602-ddf05097df49",
        assunto: "Empresa aprovada na PARTSAGRICOLA",
        mensagem: "Sua empresa foi aprovada e já pode operar na PARTSAGRICOLA.",
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
            id: "destino-id",
            name: "notificacao.destinatarioId",
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
            id: "mensagem",
            name: "notificacao.mensagem",
            value: expr(
              "O anúncio {{ $json.dados.anuncioId }} aguarda moderação.",
            ),
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
        destinatarioId: "administracao",
        entidadeId: "0ca1b60c-d10b-4c52-b29e-9c5f659eaee0",
        assunto: "Novo anúncio aguardando moderação",
        mensagem:
          "O anúncio 0ca1b60c-d10b-4c52-b29e-9c5f659eaee0 aguarda moderação.",
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
            id: "destino-id",
            name: "notificacao.destinatarioId",
            value: expr("{{ $json.dados.empresaId }}"),
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
            id: "mensagem",
            name: "notificacao.mensagem",
            value: expr(
              "O anúncio {{ $json.dados.anuncioId }} foi aprovado e publicado.",
            ),
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
        destinatarioId: "8cb3b9af-482f-41ca-a602-ddf05097df49",
        entidadeId: "0ca1b60c-d10b-4c52-b29e-9c5f659eaee0",
        assunto: "Anúncio publicado na PARTSAGRICOLA",
        mensagem:
          "O anúncio 0ca1b60c-d10b-4c52-b29e-9c5f659eaee0 foi aprovado e publicado.",
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
            id: "destino-id",
            name: "notificacao.destinatarioId",
            value: expr("{{ $json.dados.empresaAnuncianteId }}"),
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
            id: "mensagem",
            name: "notificacao.mensagem",
            value: expr(
              "Seu anúncio {{ $json.dados.anuncioId }} recebeu um novo interesse comercial.",
            ),
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
        destinatarioId: "8cb3b9af-482f-41ca-a602-ddf05097df49",
        entidadeId: "b748f81b-f5ca-46a1-af67-6b82d39cc29f",
        assunto: "Novo interesse em seu anúncio",
        mensagem:
          "Seu anúncio 0ca1b60c-d10b-4c52-b29e-9c5f659eaee0 recebeu um novo interesse comercial.",
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

const registrarProcessamento = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Registrar evento processado",
    parameters: {
      resource: "row",
      operation: "insert",
      dataTableId: {
        __rl: true,
        mode: "id",
        value: "wIdWMl1CgbQYxtZ1",
        cachedResultName: "partsagricola_eventos_processados",
      },
      columns: {
        mappingMode: "defineBelow",
        value: {
          event_id: expr('{{ $("Validar contrato do evento").item.json.id }}'),
          event_key: expr(
            '{{ $("Validar contrato do evento").item.json.chave }}',
          ),
          event_type: expr(
            '{{ $("Validar contrato do evento").item.json.tipo }}',
          ),
          correlation_id: expr(
            '{{ $("Validar contrato do evento").item.json.correlacaoId }}',
          ),
          processed_at: expr("{{ $now.toISO() }}"),
        },
        schema: [
          {
            id: "event_id",
            displayName: "event_id",
            required: true,
            defaultMatch: true,
            display: true,
            type: "string",
            canBeUsedToMatch: true,
          },
          {
            id: "event_key",
            displayName: "event_key",
            required: true,
            defaultMatch: false,
            display: true,
            type: "string",
            canBeUsedToMatch: true,
          },
          {
            id: "event_type",
            displayName: "event_type",
            required: true,
            defaultMatch: false,
            display: true,
            type: "string",
            canBeUsedToMatch: true,
          },
          {
            id: "correlation_id",
            displayName: "correlation_id",
            required: true,
            defaultMatch: false,
            display: true,
            type: "string",
            canBeUsedToMatch: true,
          },
          {
            id: "processed_at",
            displayName: "processed_at",
            required: true,
            defaultMatch: false,
            display: true,
            type: "dateTime",
            canBeUsedToMatch: true,
          },
        ],
      },
      options: {},
    },
  },
  output: [
    {
      id: 1,
      createdAt: "2026-10-17T12:00:01.000Z",
      updatedAt: "2026-10-17T12:00:01.000Z",
    },
  ],
});

export default workflow(
  "partsagricola-operacao",
  "[Marketplace] Operação — PARTSAGRICOLA v2",
)
  .add(receberEvento)
  .to(normalizarEvento)
  .to(validarContrato)
  .to(
    contratoValido
      .onTrue(
        verificarEventoInedito.to(
          rotearEvento
            .onCase(0, prepararAnaliseEmpresa.to(registrarProcessamento))
            .onCase(1, prepararEmpresaAprovada.to(registrarProcessamento))
            .onCase(2, prepararModeracaoAnuncio.to(registrarProcessamento))
            .onCase(3, prepararAnuncioPublicado.to(registrarProcessamento))
            .onCase(4, prepararInteresseRecebido.to(registrarProcessamento))
            .onCase(5, eventoNaoSuportado.to(registrarProcessamento)),
        ),
      )
      .onFalse(eventoInvalido),
  )
  .group(
    "Recepção validada e idempotente",
    [normalizarEvento, validarContrato, contratoValido],
    {
      description:
        "Normaliza e valida o envelope v1 antes de consultar o histórico persistente.",
    },
  );
