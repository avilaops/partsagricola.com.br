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

  // A Cloudflare guarda o HTML das páginas públicas por até 1 dia (regra de
  // cache criada em 21/08/2026). Quando o catálogo muda de verdade, o cache
  // do edge tem que cair junto — senão o visitante vê preço/foto velhos por
  // um dia. Quem chama diz se houve mudança ({"purgar": false} quando o sync
  // não alterou nada); sem corpo, purga — é o caminho dos scripts manuais.
  let purgar = true
  try {
    const corpo = await requisicao.json()
    if (corpo && corpo.purgar === false) purgar = false
  } catch {
    // sem corpo JSON: purga
  }
  let cloudflare: string = "não configurada"
  if (purgar && process.env.CF_ZONE_ID && process.env.CF_PURGE_TOKEN) {
    try {
      const resposta = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CF_PURGE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ purge_everything: true }),
          signal: AbortSignal.timeout(10000),
        }
      )
      cloudflare = resposta.ok ? "purgada" : `erro ${resposta.status}`
    } catch (erro) {
      cloudflare = `falhou: ${(erro as Error)?.message ?? erro}`
    }
  } else if (!purgar) {
    cloudflare = "sem mudança, não purgada"
  }
  return NextResponse.json({ ok: true, revalidado: "catalogo", cloudflare })
}
