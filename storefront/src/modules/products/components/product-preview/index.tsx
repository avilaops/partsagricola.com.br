import { Text } from "@medusajs/ui"
import { listProducts } from "@lib/data/products"
import { getProductPrice } from "@lib/util/get-product-price"
import { getProductCode, getTechnicalAttributes } from "@lib/util/product-technical"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"
import ProductPreviewQuoteButton from "./quote-button"
import CompareButton from "@modules/compare/components/compare-button"
import SaveProductButton from "@modules/saved-products/components/save-product-button"

export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  // const pricedProduct = await listProducts({
  //   regionId: region.id,
  //   queryParams: { id: [product.id!] },
  // }).then(({ response }) => response.products[0])

  // if (!pricedProduct) {
  //   return null
  // }

  const { cheapestPrice } = getProductPrice({
    product,
  })
  const code = getProductCode(product)

  return (
    <article className="group" data-testid="product-wrapper">
      <div className="relative">
        <LocalizedClientLink href={`/products/${product.handle}`}>
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            alt={product.title}
            size="full"
            isFeatured={isFeatured}
          />
        </LocalizedClientLink>
        <ProductPreviewQuoteButton
          product={{
            id: product.id,
            handle: product.handle,
            title: product.title,
            code,
            thumbnail: product.thumbnail,
          }}
        />
        <SaveProductButton
          product={{
            id: product.id,
            handle: product.handle,
            title: product.title,
            code,
            thumbnail: product.thumbnail,
          }}
        />
      </div>
      <LocalizedClientLink href={`/products/${product.handle}`} className="block">
        <div className="flex txt-compact-medium mt-4 justify-between">
          <div className="min-w-0 pr-3">
            <Text className="line-clamp-2 text-ui-fg-subtle" data-testid="product-title">
              {product.title}
            </Text>
            <p className="mt-1 font-mono text-xs font-semibold text-[#0b6b3a]">
              {code}
            </p>
          </div>
          <div className="flex items-center gap-x-2">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          </div>
        </div>
      </LocalizedClientLink>
      <CompareButton
        product={{
          id: product.id,
          handle: product.handle,
          title: product.title,
          code,
          thumbnail: product.thumbnail,
          attributes: getTechnicalAttributes(product),
        }}
      />
    </article>
  )
}
