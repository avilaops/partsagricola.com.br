import "server-only"

import {
  contarPublicados,
  listarCategorias,
  produtosParaSitemap,
} from "@lib/data/catalogo"

/**
 * Dados dos sitemaps, servidos pela camada `catalogo_odoo` (antes vinham da
 * Store API do Medusa). Os tipos mantêm o formato que as rotas de sitemap
 * consomem.
 */

export type SitemapProduct = {
  handle: string
  updated_at?: string
  thumbnail?: string | null
  images?: Array<{ url: string }>
}

export type SitemapTaxonomy = {
  handle: string
  updated_at?: string
}

export async function getPublishedProductCount(): Promise<number> {
  return contarPublicados()
}

export async function getSitemapProducts(
  offset: number,
  total: number
): Promise<SitemapProduct[]> {
  const produtos = await produtosParaSitemap(offset, total)
  return produtos.map((produto) => ({
    handle: produto.handle,
    updated_at: produto.atualizadoEm,
    thumbnail: produto.imagemUrl,
    images: produto.imagemUrl ? [{ url: produto.imagemUrl }] : [],
  }))
}

export async function getSitemapTaxonomies(): Promise<{
  categories: SitemapTaxonomy[]
  collections: SitemapTaxonomy[]
}> {
  const categorias = await listarCategorias()
  return {
    categories: categorias.map((categoria) => ({ handle: categoria.handle })),
    // Coleções nunca existiram de fato (zero no banco); a rota morreu junto
    // com o Medusa.
    collections: [],
  }
}
