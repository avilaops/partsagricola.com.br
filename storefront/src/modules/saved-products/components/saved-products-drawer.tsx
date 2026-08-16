"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { useQuoteList } from "@modules/quote-list/context/quote-list-context"
import { useSavedProducts } from "@modules/saved-products/context/saved-products-context"
import { useParams } from "next/navigation"

const SavedProductsDrawer = () => {
  const {
    items,
    isOpen,
    closeSaved,
    removeProduct,
    clearProducts,
  } = useSavedProducts()
  const { addItem, hasItem, openList } = useQuoteList()
  const countryCode = useParams().countryCode as string

  const addToQuote = (product: (typeof items)[number]) => {
    addItem({
      id: product.id,
      handle: product.handle,
      title: product.title,
      code: product.code,
      thumbnail: product.thumbnail,
      url: `/${countryCode}/products/${product.handle}`,
    })
  }

  const addAllToQuote = () => {
    items.forEach(addToQuote)
    closeSaved()
    openList()
  }

  return (
    <Dialog open={isOpen} onClose={closeSaved} className="relative z-[82]">
      <div className="fixed inset-0 bg-black/35 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 flex justify-end">
        <DialogPanel className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-[#0B6B3F] px-6 py-6 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Sua seleção
              </p>
              <DialogTitle className="mt-1 text-2xl font-semibold">
                Peças salvas
              </DialogTitle>
              <p className="mt-1 text-sm text-white/75">
                {items.length} {items.length === 1 ? "item salvo" : "itens salvos"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeSaved}
              className="rounded-full border border-white/25 p-2 hover:bg-white/10"
              aria-label="Fechar peças salvas"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {items.length ? (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-2">
                {items.map((product) => {
                  const isInQuote = hasItem(product.id)

                  return (
                    <article key={product.id} className="grid grid-cols-[72px_1fr] gap-4 border-b border-ui-border-base py-5">
                      <LocalizedClientLink
                        href={`/products/${product.handle}`}
                        onClick={closeSaved}
                        className="overflow-hidden rounded-xl border border-ui-border-base bg-[#f7faf8]"
                      >
                        <Thumbnail thumbnail={product.thumbnail} alt={product.title} size="square" />
                      </LocalizedClientLink>
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs font-semibold text-[#0B6B3F]">{product.code}</p>
                            <LocalizedClientLink
                              href={`/products/${product.handle}`}
                              onClick={closeSaved}
                              className="mt-1 line-clamp-2 text-sm font-semibold leading-snug hover:text-[#0B6B3F]"
                            >
                              {product.title}
                            </LocalizedClientLink>
                          </div>
                          <button type="button" onClick={() => removeProduct(product.id)} className="text-xs text-ui-fg-muted hover:text-red-600">
                            Remover
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => addToQuote(product)}
                          disabled={isInQuote}
                          className="mt-4 text-xs font-semibold text-[#0B6B3F] disabled:text-ui-fg-muted"
                        >
                          {isInQuote ? "Já está na cotação" : "+ Adicionar à cotação"}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
              <div className="border-t border-ui-border-base bg-[#f7faf8] p-5">
                <button
                  type="button"
                  onClick={addAllToQuote}
                  className="flex min-h-12 w-full items-center justify-center rounded-base bg-[#0B6B3F] px-5 text-sm font-semibold text-white hover:bg-[#08552e]"
                  data-testid="saved-add-all-to-quote"
                >
                  Adicionar todas à cotação
                </button>
                <button type="button" onClick={clearProducts} className="mt-3 w-full text-center text-xs text-ui-fg-muted hover:text-red-600">
                  Limpar peças salvas
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e7f3eb] text-[#0B6B3F]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M12 20.25S4.5 16 4.5 9.75A4.25 4.25 0 0 1 12 7a4.25 4.25 0 0 1 7.5 2.75C19.5 16 12 20.25 12 20.25Z" />
                </svg>
              </div>
              <h2 className="mt-5 text-xl font-semibold">Nenhuma peça salva</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ui-fg-subtle">
                Use o coração nos produtos para montar uma seleção e retomar depois.
              </p>
              <LocalizedClientLink href="/store" onClick={closeSaved} className="mt-6 rounded-base bg-[#0B6B3F] px-6 py-3 text-sm font-semibold text-white">
                Explorar catálogo
              </LocalizedClientLink>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export default SavedProductsDrawer
