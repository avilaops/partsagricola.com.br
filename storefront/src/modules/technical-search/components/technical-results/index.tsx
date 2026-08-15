import {
  TechnicalProductType,
  TechnicalSearchInput,
  searchProductsByDimensions,
} from "@lib/data/technical-search"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Pagination } from "@modules/store/components/pagination"
import Image from "next/image"

const PRODUCT_LIMIT = 12

const metadataValue = (
  metadata: Record<string, unknown> | null,
  key: string
) => {
  const value = metadata?.[key]
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : ""
}

const formatDimensions = (
  type: TechnicalProductType,
  metadata: Record<string, unknown> | null
) => {
  if (type === "oring") {
    return `Ø ${metadataValue(metadata, "internal_diameter_mm")} × seção ${metadataValue(
      metadata,
      "section_mm"
    )} mm`
  }

  const firstDimension =
    type === "retentor"
      ? metadataValue(metadata, "shaft_mm")
      : metadataValue(metadata, "internal_mm")

  return `${firstDimension} × ${metadataValue(
    metadata,
    "external_mm"
  )} × ${metadataValue(metadata, "height_mm")} mm`
}

const TechnicalResults = async ({ input }: { input: TechnicalSearchInput }) => {
  const { products, count } = await searchProductsByDimensions(input)
  const page = input.page || 1
  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  return (
    <section className="mt-10" aria-labelledby="technical-results-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-ui-border-base pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0b6b3a]">
            Correspondência exata
          </p>
          <h2 id="technical-results-title" className="mt-1 text-2xl font-semibold">
            {count.toLocaleString("pt-BR")} {count === 1 ? "peça encontrada" : "peças encontradas"}
          </h2>
        </div>
        <p className="text-sm text-ui-fg-subtle">
          Medidas verificadas nos dados técnicos
        </p>
      </div>

      {products.length ? (
        <ul className="grid grid-cols-1 gap-4 xsmall:grid-cols-2 small:grid-cols-3 medium:grid-cols-4">
          {products.map((product) => {
            const code = metadataValue(product.metadata, "source_code")

            return (
              <li key={product.id}>
                <LocalizedClientLink
                  href={`/products/${product.handle}`}
                  className="group flex h-full flex-col overflow-hidden rounded-large border border-ui-border-base bg-white transition hover:-translate-y-0.5 hover:border-[#75af8d] hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] bg-[#f6f8f7]">
                    {product.thumbnail ? (
                      <Image
                        src={product.thumbnail}
                        alt={product.title}
                        fill
                        sizes="(min-width: 1280px) 25vw, (min-width: 512px) 50vw, 100vw"
                        className="object-contain p-5"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="rounded-full border border-dashed border-ui-border-strong px-4 py-2 text-xs font-semibold text-ui-fg-muted">
                          {code || "Peça técnica"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    {code ? (
                      <p className="text-xs font-bold uppercase tracking-wide text-[#0b6b3a]">
                        {code}
                      </p>
                    ) : null}
                    <h3 className="mt-2 line-clamp-3 text-sm font-semibold leading-5 text-ui-fg-base">
                      {product.title}
                    </h3>
                    <p className="mt-4 rounded-rounded bg-[#edf8f1] px-3 py-2 text-xs font-semibold text-[#075b31]">
                      {formatDimensions(input.type, product.metadata)}
                    </p>
                    <span className="mt-4 text-sm font-semibold text-[#0b6b3a] group-hover:underline">
                      Ver detalhes →
                    </span>
                  </div>
                </LocalizedClientLink>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-large border border-dashed border-ui-border-strong bg-white px-6 py-12 text-center">
          <h3 className="text-lg font-semibold">Nenhuma medida exata encontrada</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ui-fg-subtle">
            Revise os valores ou envie as medidas para nossa equipe confirmar
            equivalências e alternativas técnicas.
          </p>
          <LocalizedClientLink
            href="/contato"
            className="mt-5 inline-flex rounded-rounded border border-[#0b6b3a] px-5 py-2.5 text-sm font-semibold text-[#0b6b3a] hover:bg-[#edf8f1]"
          >
            Solicitar ajuda técnica
          </LocalizedClientLink>
        </div>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} /> : null}
    </section>
  )
}

export default TechnicalResults
