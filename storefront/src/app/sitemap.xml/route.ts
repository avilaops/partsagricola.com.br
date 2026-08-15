import { getPublishedProductCount } from "@lib/seo/catalog"
import { escapeXml, xmlResponse } from "@lib/seo/xml"
import { getBaseURL } from "@lib/util/env"

const PRODUCTS_PER_SITEMAP = 1000

export const dynamic = "force-dynamic"

export async function GET() {
  const baseUrl = getBaseURL()
  const productCount = await getPublishedProductCount()
  const productSitemaps = Math.ceil(productCount / PRODUCTS_PER_SITEMAP)
  const locations = [
    `${baseUrl}/sitemaps/static.xml`,
    ...Array.from(
      { length: productSitemaps },
      (_, index) => `${baseUrl}/sitemaps/products/${index}.xml`
    ),
  ]

  return xmlResponse(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...locations.map(
        (location) =>
          `  <sitemap><loc>${escapeXml(location)}</loc></sitemap>`
      ),
      "</sitemapindex>",
    ].join("\n")
  )
}
