"use client"

import { useEffect } from "react"

import { ANALYTICS_CURRENCY, pushDataLayer } from "@lib/util/analytics"

/**
 * `view_item_list` da pagina de listagem e, quando a listagem e resultado de
 * busca, o `search` com a contagem real.
 *
 * O `search` mora aqui e nao no autocomplete de proposito: e nesta pagina que
 * `search_results` existe de verdade. No autocomplete so ha a contagem das
 * sugestoes, que nao e o total da busca — e um numero errado no relatorio e
 * pior que um campo vazio.
 *
 * So dispara na primeira pagina: paginar nao e buscar de novo, e refazer o
 * evento a cada pagina inflaria a contagem de buscas do relatorio.
 */
export default function ListViewTracker({
  items,
  listName,
  searchTerm,
  searchResults,
  page,
}: {
  items: Array<Record<string, unknown>>
  listName: string
  searchTerm?: string
  searchResults?: number
  page: number
}) {
  useEffect(() => {
    if (searchTerm && page === 1) {
      pushDataLayer({
        event: "search",
        search_term: searchTerm,
        search_results: searchResults ?? 0,
      })
    }
  }, [page, searchResults, searchTerm])

  useEffect(() => {
    if (!items.length) return

    pushDataLayer({
      event: "view_item_list",
      ecommerce: {
        currency: ANALYTICS_CURRENCY,
        item_list_name: listName,
        items,
      },
    })
  }, [items, listName])

  return null
}
