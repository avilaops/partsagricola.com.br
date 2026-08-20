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
    atualizadoEm: linha.atualizado_em,
  }
}

const COLUNAS =
  "sku, nome, descricao, preco, moeda, imagem_url, metadata, odoo_id, atualizado_em"

// A expressão precisa ser idêntica à do índice `catalogo_odoo_busca_idx`
// (camada_leitura.sql); qualquer diferença e o Postgres varre a tabela inteira.
const BUSCA_TSV =
  "to_tsvector('portuguese', coalesce(nome, '') || ' ' || coalesce(sku, ''))"

export const listarCatalogo = unstable_cache(
  async ({
    busca,
    pagina = 1,
    porPagina = 24,
  }: {
    busca?: string
    pagina?: number
    porPagina?: number
  } = {}): Promise<{ produtos: ProdutoCatalogo[]; total: number }> => {
    const deslocamento = (Math.max(1, pagina) - 1) * porPagina

    if (busca?.trim()) {
      const consulta = busca.trim()
      const [linhas, contagem] = await Promise.all([
        pool().query<Linha>(
          `select ${COLUNAS} from catalogo_odoo
           where publicado and ${BUSCA_TSV} @@ plainto_tsquery('portuguese', $1)
           order by nome limit $2 offset $3`,
          [consulta, porPagina, deslocamento]
        ),
        pool().query<{ total: string }>(
          `select count(*) as total from catalogo_odoo
           where publicado and ${BUSCA_TSV} @@ plainto_tsquery('portuguese', $1)`,
          [consulta]
        ),
      ])
      return {
        produtos: linhas.rows.map(paraProduto),
        total: Number(contagem.rows[0].total),
      }
    }

    const [linhas, contagem] = await Promise.all([
      pool().query<Linha>(
        `select ${COLUNAS} from catalogo_odoo
         where publicado order by nome limit $1 offset $2`,
        [porPagina, deslocamento]
      ),
      pool().query<{ total: string }>(
        "select count(*) as total from catalogo_odoo where publicado"
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
