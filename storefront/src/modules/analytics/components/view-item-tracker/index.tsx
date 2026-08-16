"use client"

import { useEffect } from "react"

import { ANALYTICS_CURRENCY, pushDataLayer } from "@lib/util/analytics"

/**
 * `view_item` — a pessoa abriu a pagina de uma peca.
 *
 * O item ja chega montado do servidor: `toAnalyticsItem` nao toca em `window`,
 * entao roda na renderizacao e evita mandar o produto inteiro pro cliente so
 * pra extrair tres campos.
 *
 * Sem `value`: preco zero aqui e "sob consulta", nao produto gratis. Mandar 0
 * estragaria receita e valor de conversao no relatorio.
 */
export default function ViewItemTracker({
  item,
}: {
  item: Record<string, unknown>
}) {
  useEffect(() => {
    pushDataLayer({
      event: "view_item",
      ecommerce: { currency: ANALYTICS_CURRENCY, items: [item] },
    })
  }, [item])

  return null
}
