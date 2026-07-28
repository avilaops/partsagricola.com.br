import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import ProductLines from "@modules/home/components/product-lines"
import TrustRow from "@modules/home/components/trust-row"
import CtaBanner from "@modules/home/components/cta-banner"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: "Agricola — Peças Geomaq | Algodão, Amendoim, Construção e Verde",
  description:
    "Marketplace de peças originais Geomaq para máquinas agrícolas e de construção. Busque por código, navegue por linha (Algodão, Amendoim, Construção, Verde) e solicite orçamento direto.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero />
      <TrustRow />
      <ProductLines />
      <div className="py-4">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
      <CtaBanner />
    </>
  )
}
