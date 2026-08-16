"use client"

import { useSavedProducts } from "@modules/saved-products/context/saved-products-context"

const SavedProductsButton = () => {
  const { items, openSaved } = useSavedProducts()

  return (
    <button
      type="button"
      onClick={openSaved}
      className="flex items-center gap-1.5 transition-colors hover:text-[#0B6B3F]"
      aria-label={`Abrir ${items.length} peças salvas`}
      data-testid="saved-products-nav-button"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 20.25S4.5 16 4.5 9.75A4.25 4.25 0 0 1 12 7a4.25 4.25 0 0 1 7.5 2.75C19.5 16 12 20.25 12 20.25Z" />
      </svg>
      <span className="hidden medium:inline">Salvos</span>
      <span>({items.length})</span>
    </button>
  )
}

export default SavedProductsButton
