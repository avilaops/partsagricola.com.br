"use client"

import { getProductCode, getTechnicalAttributes } from "@lib/util/product-technical"
import { HttpTypes } from "@medusajs/types"
import { useCompare } from "@modules/compare/context/compare-context"
import { useQuoteList } from "@modules/quote-list/context/quote-list-context"
import { useParams } from "next/navigation"

const ProductMobileActions = ({
  product,
}: {
  product: HttpTypes.StoreProduct
}) => {
  const countryCode = useParams().countryCode as string
  const code = getProductCode(product)
  const {
    items: compareItems,
    isHydrated: isCompareHydrated,
    addProduct,
  } = useCompare()
  const { addItem, hasItem, openList } = useQuoteList()
  const isInQuote = hasItem(product.id)

  if (!isCompareHydrated || compareItems.length) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-ui-border-base bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur small:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-semibold text-[#0B6B3F]">{code}</p>
          <p className="mt-0.5 truncate text-xs text-ui-fg-subtle">{product.title}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            addProduct({
              id: product.id,
              handle: product.handle,
              title: product.title,
              code,
              thumbnail: product.thumbnail,
              attributes: getTechnicalAttributes(product),
            })
          }
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-base border border-[#0B6B3F]/25 text-[#0B6B3F]"
          aria-label={`Comparar ${product.title}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M7 4v16M17 4v16M4 7h6M14 17h6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isInQuote) {
              addItem({
                id: product.id,
                handle: product.handle,
                title: product.title,
                code,
                thumbnail: product.thumbnail,
                url: `/${countryCode}/products/${product.handle}`,
              })
            }

            openList()
          }}
          className="min-h-11 shrink-0 rounded-base bg-[#0B6B3F] px-5 text-sm font-semibold text-white"
          data-testid="mobile-product-quote-button"
        >
          {isInQuote ? "Ver cotação" : "Cotar peça"}
        </button>
      </div>
    </div>
  )
}

export default ProductMobileActions
