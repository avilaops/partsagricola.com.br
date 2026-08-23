import "server-only"

import { HttpTypes } from "@medusajs/types"

import { slugAplicacao } from "./catalog-applications"
import type { CategoriaCatalogo, ProdutoCatalogo } from "./catalogo"

/**
 * ProdutoCatalogo → o formato que os templates herdaram do Medusa.
 *
 * O Medusa saiu, mas dezenas de componentes (preview, ficha, cotação,
 * analytics) foram escritos contra HttpTypes.StoreProduct. Reescrever todos
 * seria trocar código estável por código novo sem ganho — o adaptador fabrica
 * só os campos que eles realmente leem (mapeados um a um do uso real) e o
 * resto do tipo simplesmente não existe em runtime.
 *
 * Identidade: `id` é o SKU. Os ids do Medusa (prod_...) morreram com ele; o
 * SKU é a chave do catálogo inteiro (Odoo, camada de leitura, cotação).
 */
export function paraStoreProduct(
  produto: ProdutoCatalogo,
  categoriasPorHandle?: Map<string, CategoriaCatalogo>
): HttpTypes.StoreProduct {
  const categoria = produto.categoria
    ? categoriasPorHandle?.get(produto.categoria)
    : undefined

  return {
    id: produto.sku,
    title: produto.nome,
    handle: produto.handle ?? produto.sku,
    description: produto.descricao,
    thumbnail: produto.imagemUrl,
    images: produto.imagemUrl
      ? [{ id: produto.sku, url: produto.imagemUrl, rank: 0 }]
      : [],
    metadata: produto.metadata,
    variants: [
      {
        id: produto.sku,
        sku: produto.sku,
        title: produto.nome,
        // Preço nulo = "sob consulta": sem calculated_price o preview não
        // renderiza preço nenhum, que é o comportamento certo — nunca R$ 0,00.
        ...(produto.preco !== null
          ? {
              calculated_price: {
                calculated_amount: produto.preco,
                original_amount: produto.preco,
                currency_code: produto.moeda.toLowerCase(),
                calculated_price: { price_list_type: "sale" },
              },
            }
          : {}),
      },
    ],
    categories: categoria
      ? [
          {
            id: categoria.handle,
            name: categoria.nome,
            handle: categoria.handle,
          },
        ]
      : [],
    collection_id: null,
    // As máquinas compatíveis viajam como tags: id = slug da página
    // /aplicacoes/<slug>, value = nome exibido. É o que a ficha do produto
    // usa para linkar "Compatível com John Deere".
    tags: produto.aplicacoes.map((nome) => ({
      id: slugAplicacao(nome),
      value: nome,
    })),
    created_at: produto.atualizadoEm,
    updated_at: produto.atualizadoEm,
  } as unknown as HttpTypes.StoreProduct
}
