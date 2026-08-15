import { getSitemapProducts } from "@lib/seo/catalog"
import { escapeXml, xmlResponse } from "@lib/seo/xml"
import { getBaseURL } from "@lib/util/env"
import { notFound } from "next/navigation"

const PRODUCTS_PER_SITEMAP = 1000

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ page: string }> }
) {
  const { page } = await context.params
  const pageNumber = Number.parseInt(page.replace(/\.xml$/, ""), 10)

  if (!Number.isInteger(pageNumber) || pageNumber < 0) {
    notFound()
  }

  const products = await getSitemapProducts(
    pageNumber * PRODUCTS_PER_SITEMAP,
    PRODUCTS_PER_SITEMAP
  )
  if (!products.length) {
    notFound()
  }

  const baseUrl = getBaseURL()
  const entries = products
    .filter((product) => product.handle)
    .map((product) => {
      const images = Array.from(
        new Set(
          [product.thumbnail, ...(product.images || []).map((image) => image.url)]
            .filter(Boolean)
            .map(String)
        )
      )
      return [
        "  <url>",
        `    <loc>${escapeXml(
          `${baseUrl}/br/products/${product.handle}`
        )}</loc>`,
        product.updated_at
          ? `    <lastmod>${escapeXml(product.updated_at)}</lastmod>`
          : "",
        ...images.map(
          (image) =>
            `    <image:image><image:loc>${escapeXml(
              image
            )}</image:loc></image:image>`
        ),
        "    <changefreq>weekly</changefreq>",
        "    <priority>0.8</priority>",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n")
    })

  return xmlResponse(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      ...entries,
      "</urlset>",
    ].join("\n")
  )
}
