import { listProducts } from "@lib/data/products"
import {
  getProductCode,
  normalizeProductCode,
} from "@lib/util/product-technical"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80)
  const countryCode =
    request.nextUrl.searchParams.get("countryCode")?.trim().toLowerCase() ||
    "br"

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const { response } = await listProducts({
    countryCode,
    queryParams: { q: query, limit: 8 },
  })
  const normalizedQuery = normalizeProductCode(query)
  const suggestions = response.products
    .map((product) => {
      const code = getProductCode(product)
      const normalizedCode = normalizeProductCode(code)
      const normalizedTitle = product.title.toUpperCase()
      const score =
        normalizedCode === normalizedQuery
          ? 0
          : normalizedCode.startsWith(normalizedQuery)
          ? 1
          : normalizedTitle.startsWith(query.toUpperCase())
          ? 2
          : 3

      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        thumbnail: product.thumbnail,
        code,
        category: product.categories?.[0]?.name,
        score,
      }
    })
    .sort((first, second) => first.score - second.score)
    .map(({ score, ...suggestion }) => suggestion)

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
      },
    }
  )
}
