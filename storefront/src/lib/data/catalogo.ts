import "server-only"

import { Pool } from "pg"
import { unstable_cache } from "next/cache"

/**
 * Camada de leitura do catálogo: a tabela `catalogo_odoo`, alimentada pelo
 * `sincronizar.py` do repo do Odoo. O site nunca fala com o Odoo — lê esta
 * tabela, que vive no mesmo banco que o storefront já acessa.
 *
 * Tudo aqui sai cacheado sob a tag "catalogo". Quem invalida é a rota
 * `/api/revalidar`, chamada pelo orquestrador (`vitrine/atualizar.py`) logo
 * depois de cada sincronização — entre uma e outra, nenhuma visita toca o
 * Postgres.
 */

export type ProdutoCatalogo = {
  sku: string
  nome: string
  descricao: string | null
  /** null = ninguém precificou ainda; a vitrine mostra "sob consulta", não R$ 0,00. */
  preco: number | null
  moeda: string
  imagemUrl: string | null
  metadata: Record<string, unknown>
  odooId: number
  atualizadoEm: string
  /** Slug da URL pública (/products/[handle]); herdado do Medusa via sync. */
  handle: string | null
  /** Handle da categoria-folha; a árvore vem de `listarCategorias()`. */
  categoria: string | null
  /** Máquinas compatíveis ("John Deere"), derivadas do nome pelo sync. */
  aplicacoes: string[]
}

// Uma pool por processo. Em dev o HMR recarrega o módulo a cada edição; sem o
// cache no globalThis cada reload abriria conexões novas até esgotar o Postgres.
const globalComPool = globalThis as typeof globalThis & { _catalogoPool?: Pool }

function pool(): Pool {
  if (!globalComPool._catalogoPool) {
    const dsn = process.env.LEITURA_DSN
    if (!dsn) {
      throw new Error("LEITURA_DSN não configurado — o catálogo não tem de onde ler.")
    }
    globalComPool._catalogoPool = new Pool({ connectionString: dsn, max: 5 })
  }
  return globalComPool._catalogoPool
}

type Linha = {
  sku: string
  nome: string
  descricao: string | null
  preco: string | null
  moeda: string
  imagem_url: string | null
  metadata: Record<string, unknown>
  odoo_id: number
  atualizado_em: string
  handle: string | null
  categoria: string | null
  aplicacoes: string[] | null
}

function paraProduto(linha: Linha): ProdutoCatalogo {
  return {
    sku: linha.sku,
    nome: linha.nome,
    descricao: linha.descricao,
    // numeric chega como string do driver; a vitrine compara e formata número.
    preco: linha.preco === null ? null : Number(linha.preco),
    moeda: linha.moeda,
    imagemUrl: linha.imagem_url,
    metadata: linha.metadata,
    odooId: linha.odoo_id,
    // O driver devolve timestamptz como Date; string ISO atravessa o cache e
    // o JSX sem surpresa.
    atualizadoEm: new Date(linha.atualizado_em).toISOString(),
    handle: linha.handle,
    categoria: linha.categoria,
    aplicacoes: linha.aplicacoes ?? [],
  }
}

const COLUNAS =
  "sku, nome, descricao, preco, moeda, imagem_url, metadata, odoo_id, atualizado_em, handle, categoria, aplicacoes"

export type CategoriaCatalogo = {
  handle: string
  nome: string
  pai: string | null
}

// A expressão precisa ser idêntica à do índice `catalogo_odoo_busca_idx`
// (camada_leitura.sql); qualquer diferença e o Postgres varre a tabela inteira.
const BUSCA_TSV =
  "to_tsvector('portuguese', coalesce(nome, '') || ' ' || coalesce(sku, ''))"

export type OrdemCatalogo = "nome" | "recentes" | "preco_asc" | "preco_desc"

export const listarCatalogo = unstable_cache(
  async ({
    busca,
    categorias,
    skus,
    aplicacao,
    ordem = "nome",
    pagina = 1,
    porPagina = 24,
  }: {
    busca?: string
    /** handles de categoria (folha + descendentes, resolvidos por quem chama) */
    categorias?: string[]
    skus?: string[]
    /** máquina compatível ("John Deere"), como derivada do nome pelo sync */
    aplicacao?: string
    ordem?: OrdemCatalogo
    pagina?: number
    porPagina?: number
  } = {}): Promise<{ produtos: ProdutoCatalogo[]; total: number }> => {
    const deslocamento = (Math.max(1, pagina) - 1) * porPagina

    const condicoes = ["publicado"]
    const parametros: unknown[] = []
    if (busca?.trim()) {
      // tsquery casa palavra inteira; comprador digita código PELA METADE
      // ("AH1294" de AH129451). O ILIKE cobre o prefixo/pedaço e usa os
      // índices de trigramas (catalogo_odoo_*_trgm_idx) — 0,2 ms, e ainda
      // fica no cache sob a tag "catalogo".
      parametros.push(busca.trim())
      const n = parametros.length
      parametros.push(`%${busca.trim()}%`)
      condicoes.push(
        `(${BUSCA_TSV} @@ plainto_tsquery('portuguese', $${n})
          or sku ilike $${n + 1} or nome ilike $${n + 1})`
      )
    }
    if (categorias?.length) {
      parametros.push(categorias)
      condicoes.push(`categoria = any($${parametros.length})`)
    }
    if (skus?.length) {
      parametros.push(skus)
      condicoes.push(`sku = any($${parametros.length})`)
    }
    if (aplicacao?.trim()) {
      parametros.push([aplicacao.trim()])
      condicoes.push(`aplicacoes @> $${parametros.length}::text[]`)
    }
    const onde = condicoes.join(" and ")

    // "recentes" ordena por odoo_id: o Odoo atribui id crescente na criação, e
    // é o único rastro de "quando entrou" que sobrevive à travessia — o
    // atualizado_em muda a cada sync. Preço nulo vai pro fim nas duas direções:
    // "sob consulta" não compete com preço de verdade.
    const ordenacao = {
      nome: "nome",
      recentes: "odoo_id desc",
      preco_asc: "preco asc nulls last, nome",
      preco_desc: "preco desc nulls last, nome",
    }[ordem]

    const [linhas, contagem] = await Promise.all([
      pool().query<Linha>(
        `select ${COLUNAS} from catalogo_odoo where ${onde}
         order by ${ordenacao}
         limit $${parametros.length + 1} offset $${parametros.length + 2}`,
        [...parametros, porPagina, deslocamento]
      ),
      pool().query<{ total: string }>(
        `select count(*) as total from catalogo_odoo where ${onde}`,
        parametros
      ),
    ])
    return {
      produtos: linhas.rows.map(paraProduto),
      total: Number(contagem.rows[0].total),
    }
  },
  ["catalogo-listar"],
  { tags: ["catalogo"] }
)

export const obterProdutoPorHandle = unstable_cache(
  async (handle: string): Promise<ProdutoCatalogo | null> => {
    // Sem filtro de `publicado`, como na busca por SKU: link indexado resolve.
    const resultado = await pool().query<Linha>(
      `select ${COLUNAS} from catalogo_odoo where handle = $1`,
      [handle]
    )
    return resultado.rows[0] ? paraProduto(resultado.rows[0]) : null
  },
  ["catalogo-produto-handle"],
  { tags: ["catalogo"] }
)

/** Máquinas compatíveis com contagem, da mais frequente: alimenta o filtro. */
export const listarAplicacoes = unstable_cache(
  async (): Promise<Array<{ nome: string; total: number }>> => {
    const resultado = await pool().query<{ nome: string; total: string }>(
      `select a as nome, count(*) as total
       from catalogo_odoo, unnest(aplicacoes) a
       where publicado group by a order by count(*) desc, a limit 24`
    )
    return resultado.rows.map((r) => ({ nome: r.nome, total: Number(r.total) }))
  },
  ["catalogo-aplicacoes"],
  { tags: ["catalogo"] }
)

/** A árvore inteira (74 nós) — quem consome monta pais/filhos em memória. */
export const listarCategorias = unstable_cache(
  async (): Promise<CategoriaCatalogo[]> => {
    const resultado = await pool().query<CategoriaCatalogo>(
      "select handle, nome, pai from categorias_catalogo order by nome"
    )
    return resultado.rows
  },
  ["catalogo-categorias"],
  { tags: ["catalogo"] }
)

/** Publicados por categoria-folha (handle → total); a árvore soma em memória. */
export const contarPorCategoria = unstable_cache(
  async (): Promise<Array<{ categoria: string; total: number }>> => {
    const resultado = await pool().query<{ categoria: string; total: string }>(
      "select categoria, count(*) as total from catalogo_odoo where publicado and categoria is not null group by categoria"
    )
    return resultado.rows.map((r) => ({
      categoria: r.categoria,
      total: Number(r.total),
    }))
  },
  ["catalogo-contagem-categorias"],
  { tags: ["catalogo"] }
)

export const contarPublicados = unstable_cache(
  async (): Promise<number> => {
    const resultado = await pool().query<{ total: string }>(
      "select count(*) as total from catalogo_odoo where publicado"
    )
    return Number(resultado.rows[0].total)
  },
  ["catalogo-contagem"],
  { tags: ["catalogo"] }
)

/** Página de sitemap: só o que o XML precisa, na ordem estável do SKU. */
export const produtosParaSitemap = unstable_cache(
  async (
    deslocamento: number,
    limite: number
  ): Promise<
    Array<{ handle: string; atualizadoEm: string; imagemUrl: string | null }>
  > => {
    const resultado = await pool().query<{
      handle: string
      atualizado_em: string
      imagem_url: string | null
    }>(
      `select handle, atualizado_em, imagem_url from catalogo_odoo
       where publicado and handle is not null
       order by sku limit $1 offset $2`,
      [limite, deslocamento]
    )
    return resultado.rows.map((linha) => ({
      handle: linha.handle,
      atualizadoEm: new Date(linha.atualizado_em).toISOString(),
      imagemUrl: linha.imagem_url,
    }))
  },
  ["catalogo-sitemap"],
  { tags: ["catalogo"] }
)

export const obterProdutoPorSku = unstable_cache(
  async (sku: string): Promise<ProdutoCatalogo | null> => {
    // Sem filtro de `publicado`: link antigo indexado ainda resolve, e a página
    // decide o que mostrar para produto fora de linha (em vez de um 404 seco).
    const resultado = await pool().query<Linha>(
      `select ${COLUNAS} from catalogo_odoo where sku = $1`,
      [sku]
    )
    return resultado.rows[0] ? paraProduto(resultado.rows[0]) : null
  },
  ["catalogo-produto"],
  { tags: ["catalogo"] }
)

/**
 * handle → SKU, para o `/api/cotacao` casar o item da lista com o
 * `default_code` do Odoo. Sem cache de propósito: cotação é rara, e o dado
 * fresco importa mais que poupar uma consulta indexada.
 */
export async function mapearSkusPorHandle(
  handles: string[]
): Promise<Map<string, string>> {
  if (!handles.length) return new Map()
  const resultado = await pool().query<{ handle: string; sku: string }>(
    "select handle, sku from catalogo_odoo where handle = any($1)",
    [handles]
  )
  return new Map(resultado.rows.map((r) => [r.handle, r.sku]))
}

/** Filtro por medidas exatas dentro da metadata (localizador `/br/medidas`). */
export const buscarPorMedidas = unstable_cache(
  async (
    medidas: Record<string, string | number>,
    limite = 50
  ): Promise<ProdutoCatalogo[]> => {
    // `@>` usa o índice GIN da metadata; montar SQL com as chaves não entra
    // aqui de propósito — o valor vai inteiro como parâmetro jsonb.
    const resultado = await pool().query<Linha>(
      `select ${COLUNAS} from catalogo_odoo
       where publicado and metadata @> $1::jsonb
       order by nome limit $2`,
      [JSON.stringify(medidas), limite]
    )
    return resultado.rows.map(paraProduto)
  },
  ["catalogo-medidas"],
  { tags: ["catalogo"] }
)
