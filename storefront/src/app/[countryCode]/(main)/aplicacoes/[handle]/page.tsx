import { Metadata } from "next"
import { notFound } from "next/navigation"

import { listarTodasAplicacoes, resolverAplicacao } from "@lib/data/aplicacoes"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ sortBy?: SortOptions; page?: string }>
}

export async function generateStaticParams() {
  // Todas as máquinas que a camada conhece (não só as oito curadas). Sem
  // alcance ao Postgres no build, nascem sob demanda (ISR).
  try {
    const todas = await listarTodasAplicacoes()
    return todas.map(({ handle }) => ({ countryCode: "br", handle }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode, handle } = await params
  const application = await resolverAplicacao(handle)

  if (!application) {
    notFound()
  }

  return {
    title: `Peças para ${application.name}`,
    description: application.description,
    alternates: {
      canonical: `/${countryCode}/aplicacoes/${application.handle}`,
    },
    openGraph: {
      title: `Peças para ${application.name}`,
      description: application.description,
      type: "website",
    },
  }
}

export default async function ApplicationPage({ params, searchParams }: Props) {
  const { countryCode, handle } = await params
  const { sortBy, page } = await searchParams
  const application = await resolverAplicacao(handle)

  if (!application) {
    notFound()
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Peças para ${application.name}`,
    description: application.description,
    url: `https://partsagricola.com.br/${countryCode}/aplicacoes/${application.handle}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Parts Agricola",
      url: "https://partsagricola.com.br/br",
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <StoreTemplate
        sortBy={sortBy}
        page={page}
        countryCode={countryCode}
        application={application}
      />
    </>
  )
}
