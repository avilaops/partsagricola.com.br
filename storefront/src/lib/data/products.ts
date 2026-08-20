"use server"

import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import { paraStoreProduct } from "./catalogo-adapter"
import {
  listarCatalogo,
  listarCategorias,
  obterProdutoPorHandle,
  obterProdutoPorSku,
  type OrdemCatalogo,
} from "./catalogo"

/**
 * A mesma assinatura que o starter tinha sobre o Medusa, servida pela camada
 * `catalogo_odoo`. Os parâmetros mantêm os nomes herdados (`category_id`,
 * `order`, `q`...) para não reescrever cada consumidor — mas a semântica de
 * identidade mudou: `category_id` carrega handles e `id` carrega SKUs, porque
 * os ids internos do Medusa morreram com ele.
 */
export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode: _countryCode,
  regionId: _regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  const limit = queryParams?.limit || 12
  const pagina = Math.max(pageParam, 1)

  // Um handle exato é a página de produto: caminho direto, sem listagem.
  const handle = (queryParams as any)?.handle as string | undefined
  if (handle) {
    const produto = await obterProdutoPorHandle(handle)
    const categorias = new Map(
      (await listarCategorias()).map((c) => [c.handle, c])
    )
    return {
      response: {
        products: produto ? [paraStoreProduct(produto, categorias)] : [],
        count: produto ? 1 : 0,
      },
      nextPage: null,
      queryParams,
    }
  }

  const porParametro: Record<string, OrdemCatalogo> = {
    "-created_at": "recentes",
    preco_asc: "preco_asc",
    preco_desc: "preco_desc",
  }
  const ordem: OrdemCatalogo =
    porParametro[(queryParams as any)?.order as string] ?? "nome"

  const { produtos, total } = await listarCatalogo({
    busca: (queryParams as any)?.q || undefined,
    categorias: (queryParams as any)?.category_id || undefined,
    skus: (queryParams as any)?.id || undefined,
    ordem,
    pagina,
    porPagina: limit,
  })

  const categorias = new Map(
    (await listarCategorias()).map((c) => [c.handle, c])
  )

  return {
    response: {
      products: produtos.map((p) => paraStoreProduct(p, categorias)),
      count: total,
    },
    nextPage: total > pagina * limit ? pageParam + 1 : null,
    queryParams,
  }
}

export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  // A ordenação agora acontece no SQL (o starter ordenava só a página
  // carregada, o que era mentira com 28 mil itens).
  const porPreco: Partial<Record<SortOptions, string>> = {
    price_asc: "preco_asc",
    price_desc: "preco_desc",
  }
  const ordemPreco = porPreco[sortBy]

  const result = await listProducts({
    pageParam: page,
    queryParams: {
      ...queryParams,
      limit: queryParams?.limit || 12,
      ...(ordemPreco ? { order: ordemPreco } : {}),
    } as any,
    countryCode,
  })

  return result
}

/** Produto por SKU no formato dos templates (ficha, cotação, contato). */
export const getProductBySku = async (
  sku: string
): Promise<HttpTypes.StoreProduct | null> => {
  const produto = await obterProdutoPorSku(sku)
  if (!produto) return null
  const categorias = new Map(
    (await listarCategorias()).map((c) => [c.handle, c])
  )
  return paraStoreProduct(produto, categorias)
}
