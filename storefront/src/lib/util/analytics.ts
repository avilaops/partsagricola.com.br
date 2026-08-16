import { HttpTypes } from "@medusajs/types"
import { getProductCode } from "@lib/util/product-technical"

/**
 * Camada fina sobre o dataLayer do GTM.
 *
 * Tudo aqui empurra evento pro dataLayer e para. Nenhuma tag do Google ou da
 * Meta e escrita no codigo do site: quem traduz esses eventos em GA4, Pixel ou
 * conversao de Ads e o container GTM-PXF6MB94, configurado pelo TagFlow. E isso
 * que permite ligar um pixel novo sem deploy.
 *
 * Se o GTM nao estiver carregado, o push cai num array que ninguem le — sem
 * erro e sem efeito.
 */

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>
}

export function pushDataLayer(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const target = window as DataLayerWindow
  target.dataLayer = target.dataLayer || []
  target.dataLayer.push(payload)
}

/**
 * Produto no formato de item do GA4 Ecommerce.
 *
 * `item_id` e o handle — o mesmo identificador da URL e do sitemap. Manter esse
 * ID igual em site, feed e anuncio e o que permite o remarketing dinamico casar
 * o item visto com o item do catalogo; IDs diferentes produzem anuncio que nao
 * monta.
 *
 * Sem `price`: neste catalogo preco zero e ausencia de preco, nao produto
 * gratis. Mandar 0 estragaria receita e valor de conversao no relatorio.
 */
export function toAnalyticsItem(
  product: HttpTypes.StoreProduct,
  index?: number
) {
  const code = getProductCode(product)

  return {
    item_id: product.handle,
    item_name: product.title,
    ...(code ? { item_variant: code } : {}),
    ...(product.collection?.title
      ? { item_category: product.collection.title }
      : {}),
    ...(typeof index === "number" ? { index } : {}),
    quantity: 1,
  }
}

export const ANALYTICS_CURRENCY = "BRL"

// --- UTM -------------------------------------------------------------------

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const

// Identificadores de clique do Google e da Meta. Chegam sozinhos, sem UTM
// nenhum, quando o anuncio usa marcacao automatica.
const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"] as const

const STORAGE_KEY = "pa_utm"

export type LeadOrigin = Partial<
  Record<(typeof UTM_KEYS)[number] | (typeof CLICK_ID_KEYS)[number], string>
> & { landing_page?: string; referrer?: string }

/**
 * Guarda a origem da primeira pagina da sessao.
 *
 * `sessionStorage` e nao `localStorage` de proposito: a atribuicao vale pela
 * visita. Guardar pra sempre faria a compra de daqui a tres meses ainda ser
 * creditada a campanha que trouxe a pessoa uma vez.
 *
 * So grava se ainda nao houver nada: quem entra por um anuncio e depois navega
 * pro catalogo nao pode perder a origem no meio do caminho — a segunda pagina
 * nao tem UTM na URL e sobrescrever apagaria a campanha.
 */
export function captureLeadOrigin() {
  if (typeof window === "undefined") return

  try {
    if (window.sessionStorage.getItem(STORAGE_KEY)) return

    const params = new URLSearchParams(window.location.search)
    const origem: LeadOrigin = {}

    for (const key of [...UTM_KEYS, ...CLICK_ID_KEYS]) {
      const value = params.get(key)
      if (value) origem[key] = value.slice(0, 120)
    }

    // Sem parametro de campanha nao ha o que atribuir. Gravar so o referrer
    // criaria uma sessao "com origem" que na verdade e trafego organico.
    if (!Object.keys(origem).length) return

    origem.landing_page = window.location.pathname
    if (document.referrer) origem.referrer = document.referrer.slice(0, 200)

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(origem))
  } catch {
    // sessionStorage bloqueado (modo privado, cookies negados). Medicao e
    // acessorio: nao pode derrubar a pagina.
  }
}

export function getLeadOrigin(): LeadOrigin | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LeadOrigin) : null
  } catch {
    return null
  }
}

/**
 * Linha de origem pra colar no fim da mensagem de cotacao.
 *
 * O GA4 sabe que a campanha X gerou um lead, mas quem le o e-mail nao — a
 * conversao acontece fora do site, no WhatsApp ou na caixa de entrada, onde
 * nenhuma tag alcanca. Sem isto, decidir quanto investir em cada campanha
 * depende de casar horario de sessao com horario de mensagem na mao.
 */
export function formatLeadOrigin(origem: LeadOrigin | null): string {
  if (!origem) return ""

  const partes = [
    origem.utm_source && `origem: ${origem.utm_source}`,
    origem.utm_medium && `midia: ${origem.utm_medium}`,
    origem.utm_campaign && `campanha: ${origem.utm_campaign}`,
    origem.utm_content && `anuncio: ${origem.utm_content}`,
    origem.utm_term && `termo: ${origem.utm_term}`,
  ].filter(Boolean)

  // Marcacao automatica do Ads manda so o gclid. Nao da pra ler o nome da
  // campanha nele, mas identifica o clique no relatorio do Ads.
  if (!partes.length) {
    const clickId = CLICK_ID_KEYS.find((key) => origem[key])
    if (clickId) partes.push(`${clickId}: ${origem[clickId]}`)
  }

  return partes.length ? `\n\n[${partes.join(" | ")}]` : ""
}
