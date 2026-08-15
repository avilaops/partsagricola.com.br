"use client"

import { SavedProduct, useSavedProducts } from "@modules/saved-products/context/saved-products-context"
import { clx } from "@medusajs/ui"

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
          ? "absolute right-3 top-3 z-10 h-10 w-10 rounded-full border border-white/80 bg-white/95 text-ui-fg-subtle shadow-md backdrop-blur-sm hover:-translate-y-0.5 hover:text-[#0b6b3a]"
          : "min-h-11 w-full rounded-base border border-[#0b6b3a]/25 bg-white px-4 text-sm font-semibold text-[#0b6b3a] hover:border-[#0b6b3a]",
        isSaved && "border-[#0b6b3a]/30 bg-[#e8f4ec] text-[#0b6b3a]"
      )}
      aria-label={
        isSaved
          ? `${variant === "panel" ? "Abrir peças salvas com" : "Remover dos salvos"} ${product.title}`
          : `Salvar ${product.title}`
      }
      data-testid="save-product-button"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={isSaved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 20.25S4.5 16 4.5 9.75A4.25 4.25 0 0 1 12 7a4.25 4.25 0 0 1 7.5 2.75C19.5 16 12 20.25 12 20.25Z" />
      </svg>
      {variant === "panel" && <span>{isSaved ? "Ver peças salvas" : "Salvar peça"}</span>}
    </button>
  )
}

export default SaveProductButton
