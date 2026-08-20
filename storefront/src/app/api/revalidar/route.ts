import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

/**
 * Aviso de que o catálogo mudou no Odoo. Quem chama é o orquestrador
 * (`vitrine/atualizar.py`, no repo do Odoo), logo depois de sincronizar a
 * tabela `catalogo_odoo`. Invalida a tag "catalogo" — todas as consultas de
 * `lib/data/catalogo.ts` — e a próxima visita lê a tabela de novo.
 *
 * O token compartilhado (VITRINE_TOKEN aqui, VITRINE_TOKEN_PARTSAGRICOLA no
 * tokens.env do servidor) existe porque a rota é pública: sem ele, qualquer um
 * derrubaria o cache em loop e cada visita viraria uma consulta ao Postgres.
 */
export async function POST(requisicao: Request) {
  const esperado = process.env.VITRINE_TOKEN
  const recebido = requisicao.headers.get("x-vitrine-token")

  // Sem VITRINE_TOKEN configurado a rota recusa tudo — falhar fechado, e não
  // virar um endpoint aberto por esquecimento de deploy.
  if (!esperado || recebido !== esperado) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  revalidateTag("catalogo")
  return NextResponse.json({ ok: true, revalidado: "catalogo" })
}
