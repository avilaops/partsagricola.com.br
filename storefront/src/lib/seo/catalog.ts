import "server-only"

const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  ""
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export type SitemapProduct = {
  handle: string
  updated_at?: string
  thumbnail?: string | null
  images?: Array<{ url: string }>
}

export type SitemapTaxonomy = {
  handle: string
  updated_at?: string
}

async function fetchStore<T>(path: string): Promise<T> {
  if (!BACKEND_URL || !PUBLISHABLE_KEY) {
    throw new Error("Medusa SEO connection is not configured")
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "x-publishable-api-key": PUBLISHABLE_KEY,
    },
    next: { revalidate: 3600 },
  })

  if (!response.ok) {
    throw new Error(`Medusa SEO request failed with ${response.status}`)
  }

  return response.json()
}

export async function getPublishedProductCount(): Promise<number> {
  const response = await fetchStore<{ count: number }>(
    "/store/products?limit=1&fields=id"
  )
  return response.count
}

export async function getSitemapProducts(
  offset: number,
  total: number
): Promise<SitemapProduct[]> {
  const pageSize = 100
  const requests: Array<Promise<{ products: SitemapProduct[] }>> = []

  for (let pageOffset = 0; pageOffset < total; pageOffset += pageSize) {
    const currentOffset = offset + pageOffset
    const currentLimit = Math.min(pageSize, total - pageOffset)
    requests.push(
      fetchStore<{ products: SitemapProduct[] }>(
        `/store/products?limit=${currentLimit}&offset=${currentOffset}` +
          "&fields=handle,updated_at,thumbnail,*images"
      )
    )
  }

  const pages = await Promise.all(requests)
  return pages.flatMap((page) => page.products)
}

export async function getSitemapTaxonomies(): Promise<{
  categories: SitemapTaxonomy[]
  collections: SitemapTaxonomy[]
}> {
  const [categoryResponse, collectionResponse] = await Promise.all([
    fetchStore<{ product_categories: SitemapTaxonomy[] }>(
      "/store/product-categories?limit=1000&fields=handle,updated_at"
    ),
    fetchStore<{ collections: SitemapTaxonomy[] }>(
      "/store/collections?limit=1000&fields=handle,updated_at"
    ),
  ])

  return {
    categories: categoryResponse.product_categories,
    collections: collectionResponse.collections,
  }
}
