"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { useQuoteList } from "@modules/quote-list/context/quote-list-context"
import { useCompare } from "@modules/compare/context/compare-context"
import { useParams } from "next/navigation"

const CompareTray = () => {
  const {
    items,
    isHydrated,
    isOpen,
    openCompare,
    closeCompare,
    removeProduct,
    clearProducts,
  } = useCompare()
  const { addItem, openList } = useQuoteList()
  const countryCode = useParams().countryCode as string
  const attributeLabels = Array.from(
    new Set(items.flatMap((item) => item.attributes.map((attribute) => attribute.label)))
  )

  if (!isHydrated || !items.length) {
    return null
  }

  const addAllToQuote = () => {
    items.forEach((product) =>
      addItem({
        id: product.id,
        handle: product.handle,
        title: product.title,
        code: product.code,
        thumbnail: product.thumbnail,
        url: `/${countryCode}/products/${product.handle}`,
      })
    )
    closeCompare()
    openList()
  }

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-[65] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-[#0B6B3F]/20 bg-white p-3 shadow-2xl small:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B6B3F]">
              Comparação técnica
            </p>
            <p className="mt-0.5 truncate text-sm text-ui-fg-subtle">
              {items.length} {items.length === 1 ? "peça selecionada" : "peças selecionadas"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button type="button" onClick={clearProducts} className="text-xs text-ui-fg-muted hover:text-red-600">
              Limpar
            </button>
            <button
              type="button"
              onClick={openCompare}
              className="rounded-base bg-[#0B6B3F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#08552e]"
              data-testid="open-compare-button"
            >
              Comparar agora
            </button>
          </div>
        </div>
      </div>

      <Dialog open={isOpen} onClose={closeCompare} className="relative z-[90]">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden="true" />
        <div className="fixed inset-0 overflow-y-auto p-3 small:p-8">
          <DialogPanel className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between bg-[#0B6B3F] px-5 py-5 text-white small:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Decisão técnica</p>
                <DialogTitle className="mt-1 text-2xl font-semibold">Comparar peças</DialogTitle>
                <p className="mt-1 text-sm text-white/75">Confira códigos, aplicações e medidas lado a lado.</p>
              </div>
              <button type="button" onClick={closeCompare} className="rounded-full border border-white/25 p-2" aria-label="Fechar comparação">
                <span aria-hidden="true" className="text-xl leading-none">×</span>
              </button>
            </div>

            <div className="overflow-x-auto p-4 small:p-7">
              {items.length === 1 && (
                <p className="mb-4 rounded-xl bg-[#f1f8f4] px-4 py-3 text-sm text-[#0B6B3F]">
                  Adicione mais uma peça para comparar os dados lado a lado.
                </p>
              )}
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className="w-44 border-b border-ui-border-base p-3 text-xs uppercase tracking-wide text-ui-fg-muted">Característica</th>
                    {items.map((product) => (
                      <th key={product.id} className="min-w-56 border-b border-l border-ui-border-base p-3 align-top">
                        <div className="flex gap-3">
                          <LocalizedClientLink href={`/products/${product.handle}`} onClick={closeCompare} className="w-16 shrink-0">
                            <Thumbnail thumbnail={product.thumbnail} alt={product.title} size="square" />
                          </LocalizedClientLink>
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-semibold text-[#0B6B3F]">{product.code}</p>
                            <p className="mt-1 line-clamp-3 font-semibold leading-snug">{product.title}</p>
                            <button type="button" onClick={() => removeProduct(product.id)} className="mt-2 text-xs font-normal text-ui-fg-muted hover:text-red-600">Remover</button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attributeLabels.map((label) => (
                    <tr key={label}>
                      <th className="border-b border-ui-border-base bg-[#f7faf8] p-3 font-semibold text-ui-fg-subtle">{label}</th>
                      {items.map((product) => (
                        <td key={product.id} className="border-b border-l border-ui-border-base p-3 text-ui-fg-base">
                          {product.attributes.find((attribute) => attribute.label === label)?.value || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-ui-border-base bg-[#f7faf8] p-5 small:flex-row small:items-center small:justify-between small:px-8">
              <p className="text-xs text-ui-fg-subtle">A comparação ajuda na triagem; confirme a aplicação antes do pedido.</p>
              <button type="button" onClick={addAllToQuote} className="rounded-base bg-[#0B6B3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#08552e]">
                Adicionar todas à cotação
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}

export default CompareTray
