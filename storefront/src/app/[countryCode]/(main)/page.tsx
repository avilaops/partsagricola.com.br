import { Metadata } from "next"

import Hero from "@modules/home/components/hero"
import ProductLines from "@modules/home/components/product-lines"
import TrustRow from "@modules/home/components/trust-row"
import CtaBanner from "@modules/home/components/cta-banner"
import { getRegion } from "@lib/data/regions"
import { listCategories, listCategoryCounts } from "@lib/data/categories"
import DimensionFinderCta from "@modules/home/components/dimension-finder-cta"
import RecentlyViewedProducts from "@modules/recently-viewed/components/recently-viewed-products"
import { selectPrimaryDepartments } from "@lib/catalog/departments"
import LatestProducts from "@modules/home/components/latest-products"

export const metadata: Metadata = {
  title: "Marketplace de peças agrícolas e para máquinas pesadas",
  description:
    "Marketplace para pesquisar peças agrícolas, industriais e para máquinas pesadas, comparar fornecedores e solicitar confirmação técnica.",
  alternates: {
    canonical: "/br",
    languages: {
      "pt-BR": "/br",
    },
  },
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)
  const [categories, totais] = await Promise.all([
    listCategories(),
    listCategoryCounts(),
  ])
  const departments = selectPrimaryDepartments(categories)
  const totaisPorHandle = Object.fromEntries(
    departments.map((d) => [d.handle, totais.get(d.handle) ?? 0])
  )

  return (
    <>
      <Hero countryCode={countryCode} />
      <TrustRow />
      <ProductLines categories={departments} totais={totaisPorHandle} />
      <LatestProducts region={region} />
      <DimensionFinderCta />
      <RecentlyViewedProducts />
      <CtaBanner />
    </>
  )
}
