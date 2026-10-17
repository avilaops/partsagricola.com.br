import { NextRequest, NextResponse } from "next/server"

import { resolveMarketplacePath } from "@lib/marketplace-route-policy"

const PAIS = (process.env.NEXT_PUBLIC_DEFAULT_REGION || "br").toLowerCase()

/**
 * Só uma responsabilidade sobrou: garantir o prefixo de país na URL (/br/...),
 * que está em 25 mil páginas indexadas. O Medusa — que este middleware
 * consultava a cada visitante para descobrir as regiões — saiu do ar; a loja
 * é uma e o país é fixo.
 */
export async function middleware(request: NextRequest) {
  const routeDecision = resolveMarketplacePath(request.nextUrl.pathname)

  if (routeDecision.action === "gone") {
    return NextResponse.json(
      {
        error: "catalogo_desativado",
        message:
          "O catálogo próprio foi desativado. A Parts Agrícola opera como marketplace de anúncios empresariais.",
      },
      { status: 410 }
    )
  }

  if (routeDecision.action === "redirect") {
    return NextResponse.redirect(
      new URL(routeDecision.destination, request.url),
      308
    )
  }

  const primeiroSegmento = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

  if (primeiroSegmento === PAIS) {
    return NextResponse.next()
  }

  // Estático com extensão passa direto (o matcher já filtra o grosso).
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  // Atrás do Caddy o server.js standalone não enxerga o Host real ao montar
  // request.nextUrl.origin — cai no hostname interno (localhost:3006). Os
  // headers do proxy montam a URL externa correta.
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host")
  const externalOrigin = forwardedHost
    ? `${forwardedProto || "https"}://${forwardedHost}`
    : request.nextUrl.origin

  const caminho =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  return NextResponse.redirect(
    `${externalOrigin}/${PAIS}${caminho}${request.nextUrl.search}`,
    307
  )
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sitemaps|llms.txt|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
