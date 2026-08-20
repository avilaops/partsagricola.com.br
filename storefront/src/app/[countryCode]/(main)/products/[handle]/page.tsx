import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductTemplate from "@modules/products/templates"
import { HttpTypes } from "@medusajs/types"
import { getBaseURL } from "@lib/util/env"
import {
  getProductCode,
  hasExactProductCode,
} from "@lib/util/product-technical"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
}

export async function generateStaticParams() {
  // Pré-gera só as primeiras 100; as outras 28 mil nascem sob demanda (ISR),
  // como já era com o Medusa. O build local não alcança o Postgres do VPS —
  // falhar aqui não pode derrubar o build.
  try {
    const { response } = await listProducts({
      countryCode: "br",
      queryParams: { limit: 100 },
    })

    return response.products
      .filter((product) => product.handle)
      .map((product) => ({ countryCode: "br", handle: product.handle }))
  } catch {
    return []
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const { handle } = params
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle },
  }).then(({ response }) => response.products[0])

  if (!product) {
    notFound()
  }

  return {
    title: product.title,
    description: product.description || product.title,
    alternates: {
      canonical: `/${params.countryCode}/products/${product.handle}`,
    },
    openGraph: {
      type: "website",
      url: `/${params.countryCode}/products/${product.handle}`,
      title: product.title,
      description: product.description || product.title,
      images: product.thumbnail
        ? [{ url: product.thumbnail, alt: product.title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description: product.description || product.title,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}

export default async function ProductPage(props: Props) {
  const params = await props.params
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const pricedProduct = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle: params.handle },
  }).then(({ response }) => response.products[0])

  if (!pricedProduct) {
    notFound()
  }

  const images = pricedProduct.images || []
  const productCode = getProductCode(pricedProduct)
  const alternatives = productCode
    ? await listProducts({
        countryCode: params.countryCode,
        queryParams: { q: productCode, limit: 12 },
      }).then(({ response }) =>
        response.products.filter(
          (product) =>
            product.id !== pricedProduct.id &&
            hasExactProductCode(product, productCode)
        )
      )
    : []
  const productUrl = `${getBaseURL()}/${params.countryCode}/products/${
    pricedProduct.handle
  }`
  const productImages = Array.from(
    new Set(
      [pricedProduct.thumbnail, ...images.map((image) => image.url)].filter(
        Boolean
      )
    )
  )
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pricedProduct.title,
    description: pricedProduct.description || pricedProduct.title,
    image: productImages,
    sku: pricedProduct.variants?.[0]?.sku || undefined,
    category: pricedProduct.categories?.[0]?.name || undefined,
    url: productUrl,
  }
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Início",
        item: `${getBaseURL()}/${params.countryCode}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Catálogo",
        item: `${getBaseURL()}/${params.countryCode}/store`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: pricedProduct.title,
        item: productUrl,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ProductTemplate
        product={pricedProduct}
        region={region}
        countryCode={params.countryCode}
        images={images}
        alternatives={alternatives}
        baseUrl={getBaseURL()}
        whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(
          /\D/g,
          ""
        )}
      />
    </>
  )
}
