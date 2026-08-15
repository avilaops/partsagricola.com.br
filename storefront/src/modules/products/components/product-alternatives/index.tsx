import { getProductCode } from "@lib/util/product-technical"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"

const ProductAlternatives = ({
  product,
  alternatives,
  region,
}: {
  product: HttpTypes.StoreProduct
  alternatives: HttpTypes.StoreProduct[]
  region: HttpTypes.StoreRegion
}) => {
  if (!alternatives.length) {
    return null
  }

  return (
    <section className="content-container my-16">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b6b3a]">
          Mesmo código técnico
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          Outras opções para {getProductCode(product)}
        </h2>
        <p className="max-w-2xl text-sm text-ui-fg-subtle">
          Encontramos outro cadastro com o mesmo código. Compare descrição,
          imagem e aplicação antes de solicitar a cotação.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-6 small:grid-cols-3 medium:grid-cols-4">
        {alternatives.map((alternative) => (
          <li key={alternative.id}>
            <ProductPreview product={alternative} region={region} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ProductAlternatives
