import { escapeXml, xmlResponse } from "@lib/seo/xml"
import { getBaseURL } from "@lib/util/env"

export async function GET() {
  const baseUrl = getBaseURL()
  const urls = [
    { path: "/br", priority: "1.0", frequency: "weekly" },
    { path: "/br/contato", priority: "0.8", frequency: "monthly" },
  ]

  return xmlResponse(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(
        ({ path, priority, frequency }) => `  <url>
    <loc>${escapeXml(`${baseUrl}${path}`)}</loc>
    <changefreq>${frequency}</changefreq>
    <priority>${priority}</priority>
  </url>`
      ),
      "</urlset>",
    ].join("\n")
  )
}
