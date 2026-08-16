"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { useLeadOrigin } from "@modules/analytics/hooks/use-lead-origin"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { useQuoteList } from "@modules/quote-list/context/quote-list-context"

const getAbsoluteUrl = (url: string) => {
  if (url.startsWith("http")) {
    return url
  }

  return typeof window === "undefined" ? url : `${window.location.origin}${url}`
}

const QuoteListDrawer = () => {
  const {
    items,
    isOpen,
    closeList,
    removeItem,
    updateQuantity,
    clearItems,
  } = useQuoteList()
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(
    /\D/g,
    ""
  )
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0)
  // Campanha que trouxe a pessoa, quando houver. A venda fecha fora do site:
  // sem isso o pedido chega na caixa de entrada sem dizer de onde veio.
  const leadOrigin = useLeadOrigin()
  const message =
    [
      "Olá! Gostaria de solicitar uma cotação técnica para os itens abaixo:",
      "",
      ...items.flatMap((item, index) => [
        `${index + 1}. ${item.code} — ${item.title}`,
        `Quantidade: ${item.quantity}`,
        `Link: ${getAbsoluteUrl(item.url)}`,
        "",
      ]),
      "Pode confirmar aplicação, preço, disponibilidade, prazo e frete?",
    ].join("\n") + leadOrigin
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : undefined
  const emailHref = `mailto:contato@partsagricola.com.br?subject=${encodeURIComponent(
    `Cotação técnica de ${items.length} ${items.length === 1 ? "item" : "itens"}`
  )}&body=${encodeURIComponent(message)}`

  return (
    <Dialog open={isOpen} onClose={closeList} className="relative z-[80]">
      <div className="fixed inset-0 bg-black/35 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 flex justify-end">
        <DialogPanel className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-[#0b6b3a] px-6 py-6 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Atendimento técnico
              </p>
              <DialogTitle className="mt-1 text-2xl font-semibold">
                Lista de cotação
              </DialogTitle>
              <p className="mt-1 text-sm text-white/75">
                {items.length} {items.length === 1 ? "peça" : "peças"} · {totalQuantity}{" "}
                {totalQuantity === 1 ? "unidade" : "unidades"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeList}
              className="rounded-full border border-white/25 p-2 transition-colors hover:bg-white/10"
              aria-label="Fechar lista de cotação"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {items.length ? (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-2">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="grid grid-cols-[72px_1fr] gap-4 border-b border-ui-border-base py-5"
                  >
                    <LocalizedClientLink
                      href={`/products/${item.handle}`}
                      onClick={closeList}
                      className="block overflow-hidden rounded-xl border border-ui-border-base bg-[#f7faf8]"
                    >
                      <Thumbnail thumbnail={item.thumbnail} size="square" />
                    </LocalizedClientLink>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-semibold text-[#0b6b3a]">
                            {item.code}
                          </p>
                          <LocalizedClientLink
                            href={`/products/${item.handle}`}
                            onClick={closeList}
                            className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ui-fg-base hover:text-[#0b6b3a]"
                          >
                            {item.title}
                          </LocalizedClientLink>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="shrink-0 text-xs text-ui-fg-muted hover:text-red-600"
                        >
                          Remover
                        </button>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-ui-fg-subtle">Quantidade</span>
                        <div className="flex items-center rounded-full border border-ui-border-base bg-white">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="h-8 w-8 text-sm hover:text-[#0b6b3a]"
                            aria-label={`Diminuir quantidade de ${item.title}`}
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="h-8 w-8 text-sm hover:text-[#0b6b3a]"
                            aria-label={`Aumentar quantidade de ${item.title}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="border-t border-ui-border-base bg-[#f7faf8] p-5">
                <p className="mb-4 text-xs leading-relaxed text-ui-fg-subtle">
                  Nossa equipe confirma compatibilidade, disponibilidade, prazo e
                  frete antes do fechamento.
                </p>
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 items-center justify-center rounded-base bg-[#0b6b3a] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#08552e]"
                    data-testid="quote-list-whatsapp-button"
                  >
                    Enviar cotação pelo WhatsApp
                  </a>
                )}
                <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                  <a href={emailHref} className="font-medium text-[#0b6b3a] hover:underline">
                    Enviar por e-mail
                  </a>
                  <button
                    type="button"
                    onClick={clearItems}
                    className="text-ui-fg-muted hover:text-red-600"
                  >
                    Limpar lista
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e7f3eb] text-[#0b6b3a]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M7 3.75h10a2 2 0 0 1 2 2v14l-7-3-7 3v-14a2 2 0 0 1 2-2Z" />
                  <path d="M9 8h6M9 11.5h4" />
                </svg>
              </div>
              <h2 className="mt-5 text-xl font-semibold">Sua lista está vazia</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ui-fg-subtle">
                Adicione as peças que precisa e envie tudo em uma única solicitação.
              </p>
              <LocalizedClientLink
                href="/store"
                onClick={closeList}
                className="mt-6 rounded-base bg-[#0b6b3a] px-6 py-3 text-sm font-semibold text-white"
              >
                Explorar catálogo
              </LocalizedClientLink>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export default QuoteListDrawer
