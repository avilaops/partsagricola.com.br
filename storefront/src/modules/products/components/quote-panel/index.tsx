"use client"

import { getProductCode, getTechnicalAttributes } from "@lib/util/product-technical"
import { useLeadOrigin } from "@modules/analytics/hooks/use-lead-origin"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useQuoteList } from "@modules/quote-list/context/quote-list-context"
import { useParams } from "next/navigation"
import CompareButton from "@modules/compare/components/compare-button"
import SaveProductButton from "@modules/saved-products/components/save-product-button"

const QuotePanel = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const code = getProductCode(product)
  const countryCode = useParams().countryCode as string
  const { addItem, hasItem, openList } = useQuoteList()
  const isAdded = hasItem(product.id)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || ""
  const productPath = `/${countryCode}/products/${product.handle}`
  const productUrl = `${baseUrl}${productPath}`
  // Campanha que trouxe a pessoa, quando houver. A venda fecha fora do site:
  // sem isso o pedido chega na caixa de entrada sem dizer de onde veio.
  const leadOrigin = useLeadOrigin()
  const message =
    [
      "Olá! Gostaria de solicitar uma cotação técnica.",
      `Produto: ${product.title}`,
      `Código: ${code}`,
      productUrl ? `Link: ${productUrl}` : undefined,
      "Pode confirmar aplicação, preço e disponibilidade?",
    ]
      .filter(Boolean)
      .join("\n") + leadOrigin
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(
    /\D/g,
    ""
  )
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : undefined
  const emailHref = `mailto:contato@partsagricola.com.br?subject=${encodeURIComponent(
    `Cotação da peça ${code}`
  )}&body=${encodeURIComponent(message)}`

  return (
    <aside className="rounded-2xl border border-[#0B6B3F]/20 bg-[#f1f8f4] p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B6B3F]">
        Cotação técnica
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ui-fg-base">
        Confirme antes de fechar
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ui-fg-subtle">
        Validamos aplicação, disponibilidade, prazo e condição comercial para
        evitar a compra da peça incorreta.
      </p>

      <div className="mt-5 rounded-xl border border-[#0B6B3F]/15 bg-white p-4">
        <span className="text-xs text-ui-fg-muted">Código para atendimento</span>
        <p className="mt-1 font-mono text-lg font-semibold text-ui-fg-base">
          {code}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            if (!isAdded) {
              addItem({
                id: product.id,
                handle: product.handle,
                title: product.title,
                code,
                thumbnail: product.thumbnail,
                url: productPath,
              })
            }

            openList()
          }}
          className="flex min-h-12 items-center justify-center rounded-base bg-[#0B6B3F] px-5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#08552e]"
          data-testid="add-to-quote-list-button"
        >
          {isAdded ? "Ver na lista de cotação" : "Adicionar à lista de cotação"}
        </button>
        <CompareButton
          variant="panel"
          product={{
            id: product.id,
            handle: product.handle,
            title: product.title,
            code,
            thumbnail: product.thumbnail,
            attributes: getTechnicalAttributes(product),
          }}
        />
        <SaveProductButton
          variant="panel"
          product={{
            id: product.id,
            handle: product.handle,
            title: product.title,
            code,
            thumbnail: product.thumbnail,
          }}
        />
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center justify-center rounded-base border border-ui-border-base bg-white px-5 text-center text-sm font-semibold text-ui-fg-base transition-colors hover:border-[#0B6B3F]"
            data-testid="quote-whatsapp-button"
          >
            Cotar somente esta peça
          </a>
        )}
        <a
          href={emailHref}
          className="text-center text-sm font-medium text-[#0B6B3F] hover:underline"
          data-testid="quote-email-button"
        >
          Solicitar por e-mail
        </a>
        <LocalizedClientLink
          href={`/contato?codigo=${encodeURIComponent(code)}&produto=${encodeURIComponent(
            product.title
          )}`}
          className="text-center text-sm font-medium text-[#0B6B3F] hover:underline"
        >
          Ver outros canais de atendimento
        </LocalizedClientLink>
      </div>

      <ul className="mt-6 space-y-2 border-t border-[#0B6B3F]/15 pt-5 text-xs text-ui-fg-subtle">
        <li>• Atendimento com o código já identificado</li>
        <li>• Confirmação técnica antes do pedido</li>
        <li>• Prazo e frete informados na proposta</li>
      </ul>
    </aside>
  )
}

export default QuotePanel
