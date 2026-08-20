import "server-only"

/**
 * Escrita no Odoo: transforma a lista de cotação do site em um orçamento
 * (`sale.order` em rascunho) no ERP.
 *
 * A regra "o site nunca fala com o Odoo" vale para o CATÁLOGO, que é lido a
 * cada visita — por isso existe a camada `catalogo_odoo`. Cotação é outra
 * conversa: acontece poucas vezes por dia, e é exatamente o registro que dá
 * sentido ao ERP. Uma chamada síncrona no envio não pesa no container
 * (`workers = 0`), e se o Odoo estiver fora do ar o formulário orienta o
 * WhatsApp — o site nunca depende do ERP para servir página.
 */

const TIMEOUT_MS = 20_000

type Env = {
  url: string
  db: string
  usuario: string
  chave: string
}

function ambiente(): Env | null {
  const { ODOO_URL, ODOO_DB, ODOO_USUARIO, ODOO_CHAVE } = process.env
  if (!ODOO_URL || !ODOO_DB || !ODOO_USUARIO || !ODOO_CHAVE) {
    return null
  }
  return { url: ODOO_URL, db: ODOO_DB, usuario: ODOO_USUARIO, chave: ODOO_CHAVE }
}

/** Diz se o envio direto pro ERP está configurado neste ambiente. */
export function cotacaoOdooDisponivel(): boolean {
  return ambiente() !== null
}

async function jsonRpc(
  env: Env,
  service: string,
  metodo: string,
  args: unknown[]
): Promise<any> {
  const resposta = await fetch(`${env.url.replace(/\/$/, "")}/jsonrpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method: metodo, args },
      id: Date.now(),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
  if (!resposta.ok) {
    throw new Error(`Odoo respondeu ${resposta.status}`)
  }
  const corpo = await resposta.json()
  if (corpo.error) {
    // O data.message do Odoo diz qual regra de negócio barrou; o resto do
    // traceback não interessa a quem chama.
    throw new Error(corpo.error.data?.message || corpo.error.message || "erro no Odoo")
  }
  return corpo.result
}

// O uid não muda enquanto a chave for a mesma; autenticar a cada envio seria
// uma ida a mais num container de processo único.
let uidCache: number | null = null

async function autenticar(env: Env): Promise<number> {
  if (uidCache) return uidCache
  const uid = await jsonRpc(env, "common", "authenticate", [
    env.db,
    env.usuario,
    env.chave,
    {},
  ])
  if (!uid || typeof uid !== "number") {
    throw new Error("autenticação recusada pelo Odoo")
  }
  uidCache = uid
  return uid
}

async function executar(
  env: Env,
  uid: number,
  modelo: string,
  metodo: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
): Promise<any> {
  return jsonRpc(env, "object", "execute_kw", [
    env.db,
    uid,
    env.chave,
    modelo,
    metodo,
    args,
    kwargs,
  ])
}

export type ItemCotacao = {
  sku: string | null
  titulo: string
  codigo: string
  quantidade: number
}

export type CotacaoRecebida = {
  nome: string
  email: string | null
  whatsapp: string | null
  mensagem: string | null
  origem: string | null
  itens: ItemCotacao[]
}

/**
 * Cria (ou reaproveita) o contato e registra o orçamento em rascunho.
 * Devolve o número do orçamento (ex.: "S00007") para o cliente guardar.
 */
export async function criarCotacaoOdoo(cotacao: CotacaoRecebida): Promise<string> {
  const env = ambiente()
  if (!env) {
    throw new Error("Odoo não configurado neste ambiente")
  }
  const uid = await autenticar(env)

  // Contato: e-mail identifica melhor que telefone (formatação varia); só cria
  // um novo quando nenhuma das duas buscas encontra.
  let partnerId: number | null = null
  if (cotacao.email) {
    const achados = await executar(env, uid, "res.partner", "search", [
      [["email", "=ilike", cotacao.email]],
    ], { limit: 1 })
    partnerId = achados[0] ?? null
  }
  if (!partnerId && cotacao.whatsapp) {
    const achados = await executar(env, uid, "res.partner", "search", [
      ["|", ["phone", "=", cotacao.whatsapp], ["mobile", "=", cotacao.whatsapp]],
    ], { limit: 1 })
    partnerId = achados[0] ?? null
  }
  if (!partnerId) {
    partnerId = await executar(env, uid, "res.partner", "create", [
      {
        name: cotacao.nome,
        ...(cotacao.email ? { email: cotacao.email } : {}),
        ...(cotacao.whatsapp ? { mobile: cotacao.whatsapp } : {}),
      },
    ])
  }

  // Itens com SKU viram linha de pedido de verdade; item que a camada de
  // leitura não resolveu não é descartado — vira nota, porque quem atende
  // precisa saber que o cliente pediu algo que o site não casou.
  const comSku = cotacao.itens.filter((i) => i.sku)
  const produtos: Array<{ id: number; default_code: string }> = comSku.length
    ? await executar(env, uid, "product.product", "search_read", [
        [["default_code", "in", comSku.map((i) => i.sku)]],
      ], { fields: ["id", "default_code"] })
    : []
  const porSku = new Map(produtos.map((p) => [p.default_code, p.id]))

  const linhas: unknown[] = []
  const semProduto: ItemCotacao[] = []
  for (const item of cotacao.itens) {
    const produtoId = item.sku ? porSku.get(item.sku) : undefined
    if (produtoId) {
      linhas.push([0, 0, { product_id: produtoId, product_uom_qty: item.quantidade }])
    } else {
      semProduto.push(item)
    }
  }

  const notaTexto = [
    "Cotação enviada pelo site partsagricola.com.br.",
    cotacao.mensagem ? `\nMensagem do cliente:\n${cotacao.mensagem}` : "",
    cotacao.whatsapp ? `\nWhatsApp: ${cotacao.whatsapp}` : "",
    semProduto.length
      ? "\nItens que o site não casou com o cadastro (confirmar manualmente):\n" +
        semProduto
          .map((i) => `- ${i.codigo} — ${i.titulo} (qtde ${i.quantidade})`)
          .join("\n")
      : "",
    cotacao.origem ? `\n${cotacao.origem.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  // `note` é campo HTML no Odoo: texto puro entra como um bloco só e as
  // quebras de linha somem na tela de quem atende.
  const nota = notaTexto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")

  const pedidoId = await executar(env, uid, "sale.order", "create", [
    {
      partner_id: partnerId,
      origin: "site partsagricola.com.br",
      note: nota,
      ...(linhas.length ? { order_line: linhas } : {}),
    },
  ])

  const [pedido] = await executar(env, uid, "sale.order", "read", [[pedidoId]], {
    fields: ["name"],
  })
  return pedido?.name || String(pedidoId)
}
