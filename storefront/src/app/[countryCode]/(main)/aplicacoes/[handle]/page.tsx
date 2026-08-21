import { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  CATALOG_APPLICATIONS,
  getCatalogApplication,
} from "@lib/data/catalog-applications"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ sortBy?: SortOptions; page?: string }>
}

export function generateStaticParams() {
  return CATALOG_APPLICATIONS.map(({ handle }) => ({
    countryCode: "br",
    handle,
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode, handle } = await params
  const application = getCatalogApplication(handle)

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
  const application = getCatalogApplication(handle)

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
