import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import ProductLines from "@modules/home/components/product-lines"
import TrustRow from "@modules/home/components/trust-row"
import CtaBanner from "@modules/home/components/cta-banner"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { listCategories } from "@lib/data/categories"
import DimensionFinderCta from "@modules/home/components/dimension-finder-cta"
import RecentlyViewedProducts from "@modules/recently-viewed/components/recently-viewed-products"

export const metadata: Metadata = {
  title: "Peças agrícolas, industriais e para máquinas pesadas",
  description:
    "Catálogo pesquisável de peças agrícolas, industriais, máquinas pesadas, retentores, O-Rings, gaxetas e kits de reparo.",
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

  const [{ collections }, categories] = await Promise.all([
    listCollections({ fields: "id, handle, title" }),
    listCategories(),
  ])

  const departments = categories
    .filter((category) => !category.parent_category)
    .sort((first, second) => (first.rank || 0) - (second.rank || 0))

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero countryCode={countryCode} />
      <TrustRow />
      <ProductLines categories={departments} />
      <DimensionFinderCta />
      <div className="py-4">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
      <RecentlyViewedProducts />
      <CtaBanner />
    </>
  )
}
