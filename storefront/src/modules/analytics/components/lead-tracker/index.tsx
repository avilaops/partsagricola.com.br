"use client"

import { useEffect } from "react"

import {
  ANALYTICS_CURRENCY,
  captureLeadOrigin,
  getLeadOrigin,
  pushDataLayer,
} from "@lib/util/analytics"

function getContactChannel(href: string) {
  if (/wa\.me|whatsapp\.com/i.test(href)) return "whatsapp"
  if (/^tel:/i.test(href)) return "telefone"
  if (/^mailto:/i.test(href)) return "email"
  return null
}

/**
 * O que a pessoa estava pedindo quando clicou. Vira `lead_subject` no GA4 e e
 * o que separa "20 leads" de "14 de retentor e 6 de o-ring" — a diferenca
 * entre um numero e uma decisao de estoque e de campanha.
 */
function getLeadSubject(anchor: HTMLAnchorElement) {
  const marcado = anchor.closest<HTMLElement>("[data-lead-subject]")
  if (marcado?.dataset.leadSubject) return marcado.dataset.leadSubject

  const texto = anchor.textContent?.trim().replace(/\s+/g, " ")
  if (texto) return texto.slice(0, 80)

  return window.location.pathname
}

/**
 * Marca como lead todo clique que tira a pessoa do site em direcao a um canal
 * de atendimento, e guarda a origem de campanha no inicio da sessao.
 *
 * O carrinho daqui e lista de cotacao: preco zero significa "sob consulta" e a
 * venda fecha no WhatsApp ou por e-mail, fora de qualquer medicao. O clique de
 * saida e o ultimo sinal observavel, e por isso e ele que faz o papel de
 * conversao no GA4 — `generate_lead` esta marcado como evento-chave, uma vez
 * por sessao.
 *
 * O listener e delegado no `document` de proposito. Instrumentar botao a botao
 * significa que todo CTA novo nasce sem medicao ate alguem lembrar — e ninguem
 * lembra. Aqui um link novo pro WhatsApp ja entra medido.
 */
export default function LeadTracker() {
  useEffect(() => {
    captureLeadOrigin()

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest("a")
      if (!anchor) return

      const channel = getContactChannel(anchor.href)

      // Clique num card de peca dentro de uma listagem. Diz qual posicao da
      // grade converte — sem isso nao da pra saber se o resultado bom estava
      // na primeira linha ou enterrado na quarta.
      if (!channel) {
        const card = anchor.closest<HTMLElement>("[data-analytics-item-id]")
        if (!card?.dataset.analyticsItemId) return

        pushDataLayer({
          event: "select_item",
          ecommerce: {
            currency: ANALYTICS_CURRENCY,
            items: [
              {
                item_id: card.dataset.analyticsItemId,
                item_name: card.dataset.analyticsItemName,
                ...(card.dataset.analyticsItemVariant
                  ? { item_variant: card.dataset.analyticsItemVariant }
                  : {}),
                quantity: 1,
              },
            ],
          },
        })
        return
      }

      const origem = getLeadOrigin()

      pushDataLayer({
        event: "generate_lead",
        lead_source: channel,
        lead_subject: getLeadSubject(anchor),
        page_path: window.location.pathname,
        // Redundante pro GA4, que ja atribui a sessao sozinho pela URL de
        // entrada. Vai junto porque o Pixel e as conversoes de Ads offline
        // leem do evento, nao da sessao.
        ...(origem?.utm_source ? { utm_source: origem.utm_source } : {}),
        ...(origem?.utm_medium ? { utm_medium: origem.utm_medium } : {}),
        ...(origem?.utm_campaign ? { utm_campaign: origem.utm_campaign } : {}),
      })
    }

    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  return null
}
