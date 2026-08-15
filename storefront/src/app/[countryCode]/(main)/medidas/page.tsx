import { Metadata } from "next"
import { Suspense } from "react"

import { TechnicalProductType } from "@lib/data/technical-search"
import DimensionSearchForm from "@modules/technical-search/components/dimension-search-form"
import TechnicalResults from "@modules/technical-search/components/technical-results"

export const metadata: Metadata = {
  title: "Buscar O-rings, retentores e gaxetas por medidas",
  description:
    "Encontre O-rings, retentores e gaxetas por diâmetro interno, externo, seção e altura em milímetros.",
  alternates: {
    canonical: "/br/medidas",
  },
  openGraph: {
    title: "Busca de vedações por medidas",
    description:
      "Consulte medidas exatas de O-rings, retentores e gaxetas no catálogo Agricola.",
    type: "website",
  },
}

type SearchParams = {
  tipo?: string
  internal?: string
  section?: string
  shaft?: string
  external?: string
  height?: string
  page?: string
}

const isProductType = (value?: string): value is TechnicalProductType =>
  value === "oring" || value === "retentor" || value === "gaxeta"

export default async function DimensionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const type = isProductType(params.tipo) ? params.tipo : "oring"
  const values = {
    internal: params.internal || "",
    section: params.section || "",
    shaft: params.shaft || "",
    external: params.external || "",
    height: params.height || "",
  }
  const hasCompleteSearch =
    (type === "oring" && values.internal && values.section) ||
    (type === "retentor" &&
      values.shaft &&
      values.external &&
      values.height) ||
    (type === "gaxeta" &&
      values.internal &&
      values.external &&
      values.height)
  const page = Math.max(Number.parseInt(params.page || "1", 10) || 1, 1)

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Busca de vedações por medidas",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://partsagricola.com.br/br/medidas",
    description: metadata.description,
  }

  return (
    <div className="bg-[#f3f7f4] py-10 small:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="content-container">
        <div className="mx-auto mb-8 max-w-3xl text-center small:mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b6b3a]">
            Localizador técnico de vedações
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight small:text-5xl">
            Encontre a peça pela medida exata
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-ui-fg-subtle small:text-lg">
            Escolha o tipo e informe as dimensões em milímetros. A consulta
            compara diretamente os dados técnicos cadastrados.
          </p>
        </div>

        <DimensionSearchForm initialType={type} initialValues={values} />

        {hasCompleteSearch ? (
          <Suspense
            key={`${type}-${Object.values(values).join("-")}-${page}`}
            fallback={
              <div className="mt-10 rounded-large bg-white px-6 py-12 text-center text-ui-fg-subtle">
                Conferindo medidas no catálogo...
              </div>
            }
          >
            <TechnicalResults
              input={{ type, ...values, page, limit: 12 }}
            />
          </Suspense>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 small:grid-cols-3">
            {[
              ["1.130", "O-rings com medidas"],
              ["45", "retentores dimensionados"],
              ["126", "gaxetas e raspadores"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-large border border-ui-border-base bg-white p-5 text-center">
                <p className="text-2xl font-semibold text-[#0b6b3a]">{value}</p>
                <p className="mt-1 text-sm text-ui-fg-subtle">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
