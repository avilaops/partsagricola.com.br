import { listProducts } from "@lib/data/products"
import { getProductCode } from "@lib/util/product-technical"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { NewProduct } from "@modules/common/icons/parts"

export default async function LatestProducts({
  region,
}: {
  region: HttpTypes.StoreRegion
}) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      limit: 5,
      order: "-created_at",
    },
  })

  if (!products.length) {
    return null
  }

  return (
    <section className="bg-[#f5f8f6] py-14 small:py-20">
      <div className="content-container grid gap-10 medium:grid-cols-[0.72fr_1.28fr] medium:items-start">
        <div className="max-w-xl medium:sticky medium:top-36">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0B6B3F]">
            <NewProduct aria-hidden="true" className="h-4 w-4" />
            Novidades no catálogo
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight small:text-4xl">
            Peças adicionadas recentemente
          </h2>
          <p className="mt-3 text-base text-ui-fg-subtle">
            Códigos e referências reais, ordenados pela inclusão mais recente.
            Em catálogo técnico, a identificação vem antes da fotografia.
          </p>
          <LocalizedClientLink
            href="/store?sortBy=created_at"
            className="mt-6 inline-flex font-semibold text-[#0B6B3F] hover:underline"
          >
            Ver todas as novidades →
          </LocalizedClientLink>
        </div>

        <ol className="overflow-hidden rounded-[24px] border border-ui-border-base bg-white">
          {products.map((product, index) => {
            const code = getProductCode(product) || "Código a confirmar"

            return (
              <li
                key={product.id}
                className="border-b border-ui-border-base last:border-b-0"
              >
                <LocalizedClientLink
                  href={`/products/${product.handle}`}
                  className="group grid min-h-24 grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-5 transition-colors hover:bg-[#f8fbf9] small:px-7"
                >
                  <span className="font-mono text-xs text-ui-fg-muted">
                    0{index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-xs font-semibold text-[#0B6B3F]">
                      {code}
                    </span>
                    <span className="mt-1 block text-base font-semibold text-ui-fg-base small:text-lg">
                      {product.title}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-xl text-[#0B6B3F] transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </LocalizedClientLink>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
