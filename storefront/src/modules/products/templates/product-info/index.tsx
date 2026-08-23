import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductCode } from "@lib/util/product-technical"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const code = getProductCode(product)

  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto">
        {product.categories?.[0] && (
          <LocalizedClientLink
            href={`/categories/${product.categories[0].handle}`}
            className="text-sm font-medium text-[#0B6B3F] hover:underline"
          >
            {product.categories[0].name}
          </LocalizedClientLink>
        )}
        <div className="w-fit rounded-full border border-ui-border-base bg-ui-bg-subtle px-3 py-1 font-mono text-xs font-semibold text-ui-fg-subtle">
          Código {code}
        </div>
        <Heading
          level="h1"
          className="text-3xl leading-tight tracking-tight text-ui-fg-base"
          data-testid="product-title"
        >
          {product.title}
        </Heading>

        <Text
          className="text-medium text-ui-fg-subtle whitespace-pre-line"
          data-testid="product-description"
        >
          {product.description ||
            "Item do catálogo técnico. Confirme a aplicação e a compatibilidade antes de solicitar o pedido."}
        </Text>

        {product.tags?.length ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ui-fg-muted">Compatível com</span>
            {product.tags.map((tag) => (
              <LocalizedClientLink
                key={tag.id}
                href={`/aplicacoes/${tag.id}`}
                className="rounded-full border border-ui-border-base bg-pa-superficie px-3 py-1 text-xs font-medium text-ui-fg-base transition-colors hover:border-pa-verde hover:text-pa-verde"
              >
                {tag.value}
              </LocalizedClientLink>
            ))}
            <span className="text-xs text-ui-fg-muted">
              (compatibilidade informada no catálogo, não afiliação)
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ProductInfo
