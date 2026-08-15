import { escapeXml, xmlResponse } from "@lib/seo/xml"
import { getBaseURL } from "@lib/util/env"
import { getSitemapTaxonomies } from "@lib/seo/catalog"
import { CATALOG_APPLICATIONS } from "@lib/data/catalog-applications"

export const dynamic = "force-dynamic"

export async function GET() {
  const baseUrl = getBaseURL()
  const { categories, collections } = await getSitemapTaxonomies()
  const urls = [
    { path: "/br", priority: "1.0", frequency: "daily", updatedAt: "" },
    {
      path: "/br/store",
      priority: "0.9",
      frequency: "daily",
      updatedAt: "",
    },
    {
      path: "/br/contato",
      priority: "0.6",
      frequency: "monthly",
      updatedAt: "",
    },
    {
      path: "/br/medidas",
      priority: "0.9",
      frequency: "weekly",
      updatedAt: "",
    },
    ...categories.map((category) => ({
      path: `/br/categories/${category.handle}`,
      priority: "0.7",
      frequency: "weekly",
      updatedAt: category.updated_at || "",
    })),
    ...CATALOG_APPLICATIONS.map((application) => ({
      path: `/br/aplicacoes/${application.handle}`,
      priority: "0.8",
      frequency: "weekly",
      updatedAt: "",
    })),
    ...collections.map((collection) => ({
      path: `/br/collections/${collection.handle}`,
      priority: "0.7",
      frequency: "weekly",
      updatedAt: collection.updated_at || "",
    })),
  ]

  return xmlResponse(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(
        ({ path, priority, frequency, updatedAt }) =>
          [
            "  <url>",
            `    <loc>${escapeXml(`${baseUrl}${path}`)}</loc>`,
            updatedAt
              ? `    <lastmod>${escapeXml(updatedAt)}</lastmod>`
              : "",
            `    <changefreq>${frequency}</changefreq>`,
            `    <priority>${priority}</priority>`,
            "  </url>",
          ]
            .filter(Boolean)
            .join("\n")
      ),
      "</urlset>",
    ].join("\n")
  )
}
