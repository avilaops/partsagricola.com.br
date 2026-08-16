"use client"

import { useQuoteList } from "@modules/quote-list/context/quote-list-context"
import { QuoteList } from "@modules/common/icons/parts/complementos"

const QuoteListButton = () => {
  const { items, openList } = useQuoteList()

  return (
    <button
      type="button"
      onClick={openList}
      className="flex items-center gap-1.5 font-medium text-[#0B6B3F] transition-colors hover:text-[#064a28]"
      aria-label={`Abrir lista de cotação com ${items.length} itens`}
      data-testid="quote-list-nav-button"
    >
      <QuoteList aria-hidden="true" className="h-4 w-4" />
      <span className="hidden small:inline">Cotação</span>
      <span>({items.length})</span>
    </button>
  )
}

export default QuoteListButton
