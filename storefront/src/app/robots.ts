import { getBaseURL } from "@lib/util/env"
import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseURL()

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/br/store",
        "/br/products/",
        "/br/categories/",
        "/br/collections/",
        "/br/aplicacoes/",
        "/br/medidas",
        "/br/confirmacao-tecnica",
        "/br/account/",
        "/br/cart/",
        "/br/checkout/",
        "/br/order/",
        // Endpoint interno do autocomplete: devolve JSON, nao e pagina.
        // Rastrear isso so gasta orcamento de crawl.
        "/api/",
        "/*?*sortBy=",
        "/*?*page=",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
