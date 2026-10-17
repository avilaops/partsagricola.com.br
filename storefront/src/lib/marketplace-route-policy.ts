export type MarketplaceRouteDecision =
  | { action: "allow" }
  | { action: "gone" }
  | { action: "redirect"; destination: string }

const LEGACY_CATALOG_SEGMENTS = new Set([
  "aplicacoes",
  "categories",
  "collections",
  "confirmacao-tecnica",
  "medidas",
  "products",
  "store",
])

const DISABLED_CATALOG_APIS = new Set([
  "/api/cotacao",
  "/api/search/suggestions",
])

export function resolveMarketplacePath(
  pathname: string
): MarketplaceRouteDecision {
  const normalized = pathname.replace(/\/+$/, "") || "/"

  if (DISABLED_CATALOG_APIS.has(normalized)) {
    return { action: "gone" }
  }

  const segments = normalized.split("/").filter(Boolean)
  const countryCode = segments[0]?.toLowerCase()
  const area = segments[1]?.toLowerCase()

  if (countryCode && area && LEGACY_CATALOG_SEGMENTS.has(area)) {
    return { action: "redirect", destination: `/${countryCode}` }
  }

  return { action: "allow" }
}
