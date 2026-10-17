import { getBaseURL } from "@lib/util/env"

export async function GET() {
  const baseUrl = getBaseURL()
  const content = `# Parts Agrícola

> Marketplace B2B que conecta empresas anunciantes a compradores do setor agrícola.

## Modelo da plataforma

- A Parts Agrícola não é lojista e não mantém catálogo ou estoque próprios.
- As empresas participantes publicam e gerenciam seus anúncios.
- Compradores encontram fornecedores e negociam pela plataforma.

## Links públicos

- [Página inicial](${baseUrl}/br)
- [Participar do marketplace](${baseUrl}/br/contato)
- [Sitemap](${baseUrl}/sitemap.xml)
`

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  })
}
