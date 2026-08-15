"use client"

import { useQuoteList } from "@modules/quote-list/context/quote-list-context"

const QuoteListButton = () => {
  const { items, openList } = useQuoteList()

  return (
    <button
      type="button"
      onClick={openList}
      className="flex items-center gap-1.5 font-medium text-[#0b6b3a] transition-colors hover:text-[#064a28]"
      aria-label={`Abrir lista de cotação com ${items.length} itens`}
      data-testid="quote-list-nav-button"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M7 3.75h10a2 2 0 0 1 2 2v14l-7-3-7 3v-14a2 2 0 0 1 2-2Z" />
        <path d="M9 8h6M9 11.5h4" />
      </svg>
      <span className="hidden small:inline">Cotação</span>
      <span>({items.length})</span>
    </button>
  )
}

export default QuoteListButton
