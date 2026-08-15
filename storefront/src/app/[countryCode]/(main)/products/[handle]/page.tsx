import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion, listRegions } from "@lib/data/regions"
import ProductTemplate from "@modules/products/templates"
import { HttpTypes } from "@medusajs/types"
import { getBaseURL } from "@lib/util/env"
import {
  getProductCode,
  hasExactProductCode,
} from "@lib/util/product-technical"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ v_id?: string }>
}

export async function generateStaticParams() {
  try {
    const countryCodes = await listRegions().then((regions) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    if (!countryCodes) {
      return []
    }

    const promises = countryCodes.map(async (country) => {
      const { response } = await listProducts({
        countryCode: country,
        queryParams: { limit: 100, fields: "handle" },
      })

      return {
        country,
        products: response.products,
      }
    })

    const countryProducts = await Promise.all(promises)

    return countryProducts
      .flatMap((countryData) =>
        countryData.products.map((product) => ({
          countryCode: countryData.country,
          handle: product.handle,
        }))
      )
      .filter((param) => param.handle)
  } catch (error) {
    console.error(
      `Failed to generate static paths for product pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }.`
    )
    return []
  }
}

function getImagesForVariant(
  product: HttpTypes.StoreProduct,
  selectedVariantId?: string
) {
  if (!selectedVariantId || !product.variants) {
    return product.images || []
  }

  const variant = product.variants!.find((v) => v.id === selectedVariantId)
  const variantImages = variant?.images || []
  if (!variant || !variantImages.length) {
    return product.images || []
  }

  const imageIdsMap = new Map(variantImages.map((image) => [image.id, true]))
  return (product.images || []).filter((image) => imageIdsMap.has(image.id))
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
  const searchParams = await props.searchParams

  const selectedVariantId = searchParams.v_id

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

  const images = getImagesForVariant(pricedProduct, selectedVariantId)
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
  const productUrl = `${getBaseURL()}/${params.countryCode}/products/${pricedProduct.handle}`
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
      />
    </>
  )
}
