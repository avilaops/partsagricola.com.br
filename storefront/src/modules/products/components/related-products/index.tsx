import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import Product from "../product-preview"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  // edit this function to define your related products logic
  const queryParams: HttpTypes.StoreProductListParams = { limit: 5 }
  if (region?.id) {
    queryParams.region_id = region.id
  }
  if (product.categories?.length) {
    queryParams.category_id = product.categories.map((category) => category.id)
  } else if (product.collection_id) {
    queryParams.collection_id = [product.collection_id]
  } else if (product.tags) {
    queryParams.tag_id = product.tags
      .map((t) => t.id)
      .filter(Boolean) as string[]
  }
  queryParams.is_giftcard = false

  const products = await listProducts({
    queryParams,
    countryCode,
  }).then(({ response }) => {
    return response.products
      .filter((responseProduct) => responseProduct.id !== product.id)
      .slice(0, 4)
  })

  if (!products.length) {
    return null
  }

  return (
    <div className="product-page-constraint">
      <div className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B6B3F]">
          Produtos relacionados
        </span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ui-fg-base">
          Peças da mesma linha ou aplicação.
        </h2>
      </div>

      <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8">
        {products.map((product) => (
          <li key={product.id}>
            <Product region={region} product={product} />
          </li>
        ))}
      </ul>
    </div>
  )
}
