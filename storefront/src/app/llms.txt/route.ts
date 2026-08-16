import { getBaseURL } from "@lib/util/env"
import { CATALOG_APPLICATIONS } from "@lib/data/catalog-applications"

export async function GET() {
  const baseUrl = getBaseURL()
  const applicationLinks = CATALOG_APPLICATIONS.map(
    (application) =>
      `- [Peças para ${application.name}](${baseUrl}/br/aplicacoes/${application.handle})`
  ).join("\n")
  const content = `# Parts Agricola

> Catálogo brasileiro de peças para máquinas agrícolas, máquinas pesadas e sistemas de vedação.

## Links principais

- [Página inicial](${baseUrl}/br)
- [Catálogo pesquisável](${baseUrl}/br/store)
- [Busca técnica por medidas](${baseUrl}/br/medidas)
- [Contato e orçamento](${baseUrl}/br/contato)
- [Sitemap completo](${baseUrl}/sitemap.xml)

## Aplicações por marca

${applicationLinks}

## Como usar o catálogo

- Pesquise pelo código exato da peça, SKU, nome ou aplicação.
- Cada produto possui uma URL canônica própria.
- Preço igual a zero significa que o item requer orçamento; não significa produto gratuito.
- Compatibilidades devem ser confirmadas pelo código e pela aplicação antes da compra.
- Marcas citadas nas descrições indicam compatibilidade, não afiliação comercial.

## Conteúdo estruturado

As páginas de produto fornecem metadados Open Graph, dados estruturados Product e BreadcrumbList, imagens com texto alternativo descritivo e URLs presentes no sitemap.
`

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  })
}
