import { Metadata } from "next"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
    q?: string
    aplicacao?: string
  }>
  params: Promise<{
    countryCode: string
  }>
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { countryCode } = await props.params
  return {
    title: "Catálogo de peças",
    description:
      "Pesquise peças agrícolas, industriais e de máquinas pesadas por código, nome ou aplicação.",
    alternates: {
      canonical: `/${countryCode}/store`,
    },
  }
}

export default async function StorePage(props: Params) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { sortBy, page, q, aplicacao } = searchParams

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      query={q}
      aplicacaoFiltro={aplicacao}
      countryCode={params.countryCode}
    />
  )
}
