"use client"

import { useQuoteList } from "@modules/quote-list/context/quote-list-context"
import { useParams } from "next/navigation"
import { Check } from "@modules/common/icons/parts/complementos"

type ProductPreviewQuoteButtonProps = {
  product: {
    id: string
    handle: string
    title: string
    code: string
    thumbnail?: string | null
  }
}

const ProductPreviewQuoteButton = ({
  product,
}: ProductPreviewQuoteButtonProps) => {
  const countryCode = useParams().countryCode as string
  const { addItem, hasItem, openList } = useQuoteList()
  const isAdded = hasItem(product.id)

  return (
    <button
      type="button"
      onClick={() => {
        if (isAdded) {
          openList()
          return
        }

        addItem({
          id: product.id,
          handle: product.handle,
          title: product.title,
          code: product.code,
          thumbnail: product.thumbnail,
          url: `/${countryCode}/products/${product.handle}`,
        })
      }}
      className="absolute bottom-3 right-3 z-10 flex min-h-10 items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3.5 text-xs font-semibold text-[#0B6B3F] shadow-lg backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-xl"
      aria-label={
        isAdded
          ? `Abrir cotação com ${product.title}`
          : `Adicionar ${product.title} à cotação`
      }
      data-testid="product-preview-quote-button"
    >
      <Check aria-hidden="true" className="h-4 w-4" />
      <span>{isAdded ? "Na cotação" : "Cotar"}</span>
    </button>
  )
}

export default ProductPreviewQuoteButton
