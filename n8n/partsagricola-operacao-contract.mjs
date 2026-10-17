const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUIRED_IDS = {
  "empresa.cadastro_solicitado": ["empresaId"],
  "empresa.aprovada": ["empresaId"],
  "anuncio.moderacao_solicitada": ["anuncioId", "empresaId"],
  "anuncio.publicado": ["anuncioId", "empresaId"],
  "interesse.recebido": ["interesseId", "anuncioId", "empresaAnuncianteId"],
};

export function normalizeEvent(input) {
  const event = input?.body ?? input ?? {};
  return {
    id: event.id ?? "",
    versao: event.versao ?? 0,
    tipo: event.tipo ?? "",
    chave: event.chave ?? "",
    ocorridoEm: event.ocorridoEm ?? "",
    correlacaoId: event.correlacaoId ?? "",
    ator: event.ator ?? {},
    dados: event.dados ?? {},
  };
}

export function validateEvent(event) {
  const requiredIds = REQUIRED_IDS[event.tipo] ?? [];
  const baseValid =
    UUID.test(event.id) &&
    event.versao === 1 &&
    typeof event.tipo === "string" &&
    event.tipo.length > 0 &&
    typeof event.chave === "string" &&
    event.chave.length > 0 &&
    UUID.test(event.correlacaoId) &&
    typeof event.ocorridoEm === "string" &&
    event.ocorridoEm.length > 0 &&
    !Number.isNaN(Date.parse(event.ocorridoEm));
  const entityValid = requiredIds.every((field) =>
    UUID.test(event.dados[field]),
  );

  return {
    valida: baseValid && entityValid,
    erro: baseValid && entityValid ? null : "evento_v1_invalido",
  };
}

export function prepareOperation(event) {
  const data = event.dados;

  switch (event.tipo) {
    case "empresa.cadastro_solicitado":
      return notification(
        "analisar_empresa",
        "administracao",
        "administracao",
        data.empresaId,
        "Nova empresa aguardando análise",
        `A empresa ${data.empresaId} solicitou cadastro e aguarda análise.`,
      );
    case "empresa.aprovada":
      return notification(
        "confirmar_empresa_aprovada",
        "empresa",
        data.empresaId,
        data.empresaId,
        "Empresa aprovada na PARTSAGRICOLA",
        "Sua empresa foi aprovada e já pode operar na PARTSAGRICOLA.",
      );
    case "anuncio.moderacao_solicitada":
      return notification(
        "moderar_anuncio",
        "administracao",
        "administracao",
        data.anuncioId,
        "Novo anúncio aguardando moderação",
        `O anúncio ${data.anuncioId} aguarda moderação.`,
      );
    case "anuncio.publicado":
      return notification(
        "confirmar_anuncio_publicado",
        "empresa",
        data.empresaId,
        data.anuncioId,
        "Anúncio publicado na PARTSAGRICOLA",
        `O anúncio ${data.anuncioId} foi aprovado e publicado.`,
      );
    case "interesse.recebido":
      return notification(
        "avisar_interesse_recebido",
        "empresa_anunciante",
        data.empresaAnuncianteId,
        data.interesseId,
        "Novo interesse em seu anúncio",
        `Seu anúncio ${data.anuncioId} recebeu um novo interesse comercial.`,
      );
    default:
      return {
        processamento: {
          estado: "ignorado",
          motivo: "tipo_evento_nao_suportado",
        },
      };
  }
}

function notification(
  acao,
  destinatarioTipo,
  destinatarioId,
  entidadeId,
  assunto,
  mensagem,
) {
  return {
    notificacao: {
      acao,
      destinatarioTipo,
      destinatarioId,
      entidadeId,
      assunto,
      mensagem,
    },
    processamento: { estado: "preparado" },
  };
}
