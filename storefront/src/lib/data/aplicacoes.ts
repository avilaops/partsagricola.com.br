import "server-only"

import {
  CATALOG_APPLICATIONS,
  type CatalogApplication,
  slugAplicacao,
} from "./catalog-applications"
import { listarAplicacoes } from "./catalogo"

/**
 * Páginas /aplicacoes/<máquina> para TODAS as máquinas do catálogo, não só as
 * oito curadas. A lista vem da camada (`aplicacoes[]`, derivada do nome pelo
 * sync): John Deere, Case, Caterpillar… mas também Jacto, Stara, Valmet, JCB.
 * As curadas mantêm a descrição escrita à mão; as demais ganham uma genérica
 * honesta, com a contagem real.
 */
export async function listarTodasAplicacoes(): Promise<
  Array<CatalogApplication & { total: number }>
> {
  const daCamada = await listarAplicacoes()
  const porSlug = new Map<string, CatalogApplication & { total: number }>()
  for (const item of daCamada) {
    const handle = slugAplicacao(item.nome)
    if (!handle) continue
    const curada = CATALOG_APPLICATIONS.find((a) => a.handle === handle)
    porSlug.set(handle, {
      handle,
      name: curada?.name ?? item.nome,
      description:
        curada?.description ??
        `Peças compatíveis com máquinas ${item.nome} — ${item.total.toLocaleString("pt-BR")} referências com código, nome e aplicação para confirmação técnica.`,
      total: item.total,
    })
  }
  // Curada que (ainda) não apareceu na camada continua existindo.
  for (const curada of CATALOG_APPLICATIONS) {
    if (!porSlug.has(curada.handle)) porSlug.set(curada.handle, { ...curada, total: 0 })
  }
  return Array.from(porSlug.values()).sort((a, b) => b.total - a.total)
}

export async function resolverAplicacao(
  handle: string
): Promise<(CatalogApplication & { total: number }) | undefined> {
  const todas = await listarTodasAplicacoes()
  return todas.find((a) => a.handle === handle)
}
