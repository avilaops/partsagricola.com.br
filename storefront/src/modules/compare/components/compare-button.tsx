"use client"

import { CompareProduct, useCompare } from "@modules/compare/context/compare-context"

const CompareButton = ({
  product,
  variant = "card",
}: {
  product: CompareProduct
  variant?: "card" | "panel"
}) => {
  const { addProduct, hasProduct, isHydrated, items, openCompare } = useCompare()
  const isAdded = hasProduct(product.id)
  const isFull = items.length >= 4 && !isAdded

  return (
    <button
      type="button"
      disabled={!isHydrated || isFull}
      onClick={() => {
        if (isAdded) {
          openCompare()
          return
        }

        addProduct(product)
      }}
      className={
        variant === "panel"
          ? "flex min-h-11 items-center justify-center gap-2 rounded-base border border-[#0B6B3F]/25 bg-white px-4 text-sm font-semibold text-[#0B6B3F] transition-colors hover:border-[#0B6B3F] disabled:cursor-not-allowed disabled:opacity-50"
          : "mt-3 flex items-center gap-1.5 text-xs font-medium text-ui-fg-muted transition-colors hover:text-[#0B6B3F] disabled:cursor-not-allowed disabled:opacity-50"
      }
      aria-label={
        isAdded
          ? `Abrir comparação com ${product.title}`
          : `Comparar ${product.title}`
      }
      data-testid="compare-product-button"
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          isAdded ? "border-[#0B6B3F] bg-[#0B6B3F] text-white" : "border-ui-border-strong"
        }`}
      >
        {isAdded ? "✓" : ""}
      </span>
      {isAdded ? "Na comparação" : isFull ? "Limite de 4 peças" : "Comparar"}
    </button>
  )
}

export default CompareButton
