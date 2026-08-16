"use client"

import { SavedProduct, useSavedProducts } from "@modules/saved-products/context/saved-products-context"
import { clx } from "@medusajs/ui"
import { Favorites } from "@modules/common/icons/parts"

const SaveProductButton = ({
  product,
  variant = "card",
}: {
  product: SavedProduct
  variant?: "card" | "panel"
}) => {
  const { isHydrated, saveProduct, removeProduct, hasProduct, openSaved } =
    useSavedProducts()
  const isSaved = hasProduct(product.id)

  return (
    <button
      type="button"
      disabled={!isHydrated}
      onClick={() => {
        if (isSaved) {
          if (variant === "panel") {
            openSaved()
          } else {
            removeProduct(product.id)
          }
          return
        }

        saveProduct(product)
      }}
      className={clx(
        "flex items-center justify-center gap-2 transition-all disabled:opacity-50",
        variant === "card"
          ? "absolute right-3 top-3 z-10 h-10 w-10 rounded-full border border-white/80 bg-white/95 text-ui-fg-subtle shadow-md backdrop-blur-sm hover:-translate-y-0.5 hover:text-[#0B6B3F]"
          : "min-h-11 w-full rounded-base border border-[#0B6B3F]/25 bg-white px-4 text-sm font-semibold text-[#0B6B3F] hover:border-[#0B6B3F]",
        isSaved && "border-[#0B6B3F]/30 bg-[#e8f4ec] text-[#0B6B3F]"
      )}
      aria-label={
        isSaved
          ? `${variant === "panel" ? "Abrir peças salvas com" : "Remover dos salvos"} ${product.title}`
          : `Salvar ${product.title}`
      }
      data-testid="save-product-button"
    >
      <Favorites aria-hidden="true" className="h-5 w-5" />
      {variant === "panel" && <span>{isSaved ? "Ver peças salvas" : "Salvar peça"}</span>}
    </button>
  )
}

export default SaveProductButton
