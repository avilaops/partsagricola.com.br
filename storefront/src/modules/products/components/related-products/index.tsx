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

  // Mesma categoria E mesma máquina primeiro (uma peça Case de construção
  // puxa outras peças Case de construção); só depois completa com a
  // categoria. Sem isso, toda ficha da categoria mostrava os mesmos 4 itens.
  const categorias = product.categories?.map((category) => category.id)
  const maquina = product.tags?.[0]?.value
  const buscar = (extra: Record<string, unknown>, limit: number) =>
    listProducts({
      queryParams: {
        limit,
        ...(categorias?.length ? { category_id: categorias } : {}),
        ...extra,
      } as HttpTypes.StoreProductListParams,
      countryCode,
    }).then(({ response }) =>
      response.products.filter((item) => item.id !== product.id)
    )

  const products: HttpTypes.StoreProduct[] = []
  if (categorias?.length || maquina) {
    if (maquina) {
      products.push(...(await buscar({ aplicacao: maquina }, 5)))
    }
    if (products.length < 4 && categorias?.length) {
      const vistos = new Set(products.map((item) => item.id))
      const complemento = await buscar({}, 8)
      products.push(...complemento.filter((item) => !vistos.has(item.id)))
    }
  }
  products.splice(4)

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
