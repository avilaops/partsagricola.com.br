"use client"

import { useSavedProducts } from "@modules/saved-products/context/saved-products-context"
import { Favorites } from "@modules/common/icons/parts"

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
      <Favorites aria-hidden="true" className="h-4 w-4" />
      <span className="hidden medium:inline">Salvos</span>
      <span>({items.length})</span>
    </button>
  )
}

export default SavedProductsButton
