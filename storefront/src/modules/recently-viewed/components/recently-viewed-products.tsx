"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreviewQuoteButton from "@modules/products/components/product-preview/quote-button"
import Thumbnail from "@modules/products/components/thumbnail"
import { useRecentlyViewed } from "@modules/recently-viewed/context/recently-viewed-context"
import SaveProductButton from "@modules/saved-products/components/save-product-button"

const RecentlyViewedProducts = ({
  currentProductId,
}: {
  currentProductId?: string
}) => {
  const { items, isHydrated, clearProducts } = useRecentlyViewed()
  const visibleItems = items
    .filter((item) => item.id !== currentProductId)
    .slice(0, 5)

  if (!isHydrated || !visibleItems.length) {
    return null
  }

  return (
    <section className="content-container my-16 small:my-24" aria-labelledby="recently-viewed-title">
      <div className="mb-7 flex items-end justify-between gap-6 border-b border-ui-border-base pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B6B3F]">
            Continue de onde parou
          </p>
          <h2 id="recently-viewed-title" className="mt-1 text-2xl font-semibold tracking-tight">
            Vistos recentemente
          </h2>
        </div>
        <button
          type="button"
          onClick={clearProducts}
          className="shrink-0 text-xs text-ui-fg-muted transition-colors hover:text-[#0B6B3F]"
        >
          Limpar histórico
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-4 small:grid-cols-3 medium:grid-cols-5">
        {visibleItems.map((product) => (
          <li key={product.id}>
            <article className="group">
              <div className="relative">
                <LocalizedClientLink href={`/products/${product.handle}`}>
                  <Thumbnail
                    thumbnail={product.thumbnail}
                    alt={product.title}
                    size="square"
                    className="bg-[#f7faf8]"
                  />
                </LocalizedClientLink>
                <ProductPreviewQuoteButton product={product} />
                <SaveProductButton product={product} />
              </div>
              <LocalizedClientLink href={`/products/${product.handle}`} className="mt-3 block">
                <p className="font-mono text-xs font-semibold text-[#0B6B3F]">
                  {product.code}
                </p>
                <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-ui-fg-base transition-colors group-hover:text-[#0B6B3F]">
                  {product.title}
                </h3>
              </LocalizedClientLink>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default RecentlyViewedProducts
