import { HttpTypes } from "@medusajs/types"

import { descricaoCategoria } from "../catalog/category-descriptions"
import {
  contarPorCategoria,
  listarCategorias,
  type CategoriaCatalogo,
} from "./catalogo"

/**
 * Taxonomia servida pela tabela `categorias_catalogo` (74 nós), no formato
 * que os templates herdaram do Medusa: `id`/`name`/`handle`,
 * `category_children` e `parent_category`.
 *
 * Sem referência circular de propósito: pai e filhos são cópias rasas (só um
 * nível), porque estes objetos atravessam a fronteira RSC → client e um ciclo
 * quebraria a serialização. Nenhum template desce mais de um nível de cada
 * vez — quem precisa da árvore inteira anda pelos handles.
 */

type No = {
  id: string
  name: string
  handle: string
  description: string | null
  parent_category_id: string | null
  parent_category: No | null
  category_children: No[]
}

function montarArvore(linhas: CategoriaCatalogo[]): Map<string, No> {
  const nos = new Map<string, No>()
  for (const linha of linhas) {
    nos.set(linha.handle, {
      id: linha.handle,
      name: linha.nome,
      handle: linha.handle,
      description: descricaoCategoria(linha.handle, linha.nome),
      parent_category_id: linha.pai,
      parent_category: null,
      category_children: [],
    })
  }
  for (const linha of linhas) {
    const no = nos.get(linha.handle)!
    const pai = linha.pai ? nos.get(linha.pai) : undefined
    if (pai) {
      // Cópias rasas: o filho aponta um pai sem filhos, o pai lista filhos
      // sem pai — nenhum ciclo.
      no.parent_category = { ...pai, parent_category: null, category_children: [] }
      pai.category_children.push({
        ...no,
        parent_category: null,
        category_children: [],
      })
    }
  }
  return nos
}

export const listCategories = async (
  _query?: Record<string, any>
): Promise<HttpTypes.StoreProductCategory[]> => {
  const nos = montarArvore(await listarCategorias())
  return Array.from(nos.values()) as unknown as HttpTypes.StoreProductCategory[]
}

export const getCategoryByHandle = async (
  categoryHandle: string[]
): Promise<HttpTypes.StoreProductCategory | undefined> => {
  // A URL pode vir aninhada (/categories/pai/filho); o handle é único, então
  // o último segmento identifica o nó.
  const handle = categoryHandle[categoryHandle.length - 1]
  const nos = montarArvore(await listarCategorias())
  return nos.get(handle) as unknown as HttpTypes.StoreProductCategory | undefined
}

/** handle → ele mesmo + todos os descendentes (para filtrar a listagem). */
export const listCategoryTree = async (
  handle: string
): Promise<string[]> => {
  const linhas = await listarCategorias()
  const filhosPorPai = new Map<string, string[]>()
  for (const linha of linhas) {
    if (!linha.pai) continue
    filhosPorPai.set(linha.pai, [
      ...(filhosPorPai.get(linha.pai) ?? []),
      linha.handle,
    ])
  }
  const resultado: string[] = []
  const fila = [handle]
  while (fila.length) {
    const atual = fila.pop()!
    resultado.push(atual)
    fila.push(...(filhosPorPai.get(atual) ?? []))
  }
  return resultado
}

/**
 * Total de peças publicadas por categoria, já somando os descendentes
 * (handle → total). O produto só conhece a folha; o departamento é a soma.
 */
export const listCategoryCounts = async (): Promise<Map<string, number>> => {
  const [linhas, contagens] = await Promise.all([
    listarCategorias(),
    contarPorCategoria(),
  ])
  const pai = new Map(linhas.map((linha) => [linha.handle, linha.pai]))
  const totais = new Map<string, number>()
  for (const { categoria, total } of contagens) {
    let atual: string | null | undefined = categoria
    while (atual) {
      totais.set(atual, (totais.get(atual) ?? 0) + total)
      atual = pai.get(atual)
    }
  }
  return totais
}

/**
 * Trilha de ancestrais (raiz → pai direto) de um handle. O breadcrumb precisa
 * da cadeia inteira; as cópias rasas de `parent_category` só sobem um nível.
 */
export const listCategoryParents = async (
  handle: string
): Promise<Array<{ handle: string; name: string }>> => {
  const linhas = await listarCategorias()
  const porHandle = new Map(linhas.map((linha) => [linha.handle, linha]))
  const trilha: Array<{ handle: string; name: string }> = []
  let atual = porHandle.get(handle)?.pai ?? null
  while (atual) {
    const no = porHandle.get(atual)
    if (!no) break
    trilha.unshift({ handle: no.handle, name: no.nome })
    atual = no.pai
  }
  return trilha
}
