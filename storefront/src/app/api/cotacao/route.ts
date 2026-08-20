import { NextResponse } from "next/server"

import { mapearSkusPorHandle } from "@lib/data/catalogo"
import { cotacaoOdooDisponivel, criarCotacaoOdoo } from "@lib/data/odoo"

/**
 * Recebe a lista de cotação do site e a registra como orçamento no Odoo.
 *
 * É o primeiro caminho em que um pedido do site vira registro no ERP — antes
 * disto a cotação só existia como mensagem de WhatsApp ou e-mail, invisível
 * para o Odoo. O WhatsApp e o e-mail continuam existindo no drawer como
 * alternativas; se o ERP estiver fora do ar, o formulário orienta usá-los.
 */

const MAX_ITENS = 15

type ItemBruto = {
  handle?: unknown
  code?: unknown
  title?: unknown
  quantity?: unknown
}

function textoCurto(valor: unknown, max: number): string | null {
  if (typeof valor !== "string") return null
  const limpo = valor.trim().slice(0, max)
  return limpo || null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(requisicao: Request) {
  if (!cotacaoOdooDisponivel()) {
    // Ambiente sem as credenciais (dev local, deploy incompleto): o cliente
    // ainda tem WhatsApp e e-mail — a resposta diz isso em vez de estourar.
    return NextResponse.json(
      { ok: false, erro: "indisponivel" },
      { status: 503 }
    )
  }

  let corpo: any
  try {
    corpo = await requisicao.json()
  } catch {
    return NextResponse.json({ ok: false, erro: "corpo" }, { status: 400 })
  }

  // Honeypot: campo invisível que humano nenhum preenche. Bot que preencher
  // recebe um "ok" e nada acontece — devolver erro ensinaria o script.
  if (typeof corpo.site === "string" && corpo.site.trim()) {
    return NextResponse.json({ ok: true, pedido: null })
  }

  const nome = textoCurto(corpo.nome, 120)
  const email = textoCurto(corpo.email, 200)?.toLowerCase() ?? null
  // Só dígitos: "+55 (17) 99999-9999" e "5517999999999" são o mesmo número.
  const whatsapp =
    textoCurto(corpo.whatsapp, 30)?.replace(/\D/g, "").slice(0, 15) || null
  const mensagem = textoCurto(corpo.mensagem, 2000)
  const origem = textoCurto(corpo.origem, 400)

  if (!nome || nome.length < 2) {
    return NextResponse.json({ ok: false, erro: "nome" }, { status: 400 })
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, erro: "email" }, { status: 400 })
  }
  if (!email && (!whatsapp || whatsapp.length < 10)) {
    return NextResponse.json({ ok: false, erro: "contato" }, { status: 400 })
  }

  const itensBrutos: ItemBruto[] = Array.isArray(corpo.itens)
    ? corpo.itens.slice(0, MAX_ITENS)
    : []
  const itens = itensBrutos.flatMap((item) => {
    const handle = textoCurto(item.handle, 200)
    const titulo = textoCurto(item.title, 300)
    const codigo = textoCurto(item.code, 100)
    const quantidade = Math.min(999, Math.max(1, Number(item.quantity) || 1))
    if (!titulo && !codigo && !handle) return []
    return [
      {
        handle,
        titulo: titulo || codigo || handle || "",
        codigo: codigo || handle || "",
        quantidade,
      },
    ]
  })
  if (!itens.length) {
    return NextResponse.json({ ok: false, erro: "itens" }, { status: 400 })
  }

  try {
    const skus = await mapearSkusPorHandle(
      itens.flatMap((i) => (i.handle ? [i.handle] : []))
    )
    const pedido = await criarCotacaoOdoo({
      nome,
      email,
      whatsapp,
      mensagem,
      origem,
      itens: itens.map((i) => ({
        sku: (i.handle && skus.get(i.handle)) || null,
        titulo: i.titulo,
        codigo: i.codigo,
        quantidade: i.quantidade,
      })),
    })
    return NextResponse.json({ ok: true, pedido })
  } catch (erro) {
    // O motivo fica no journal do systemd; o cliente só precisa saber que o
    // caminho alternativo existe.
    console.error("[cotacao] falha ao registrar no Odoo:", erro)
    return NextResponse.json({ ok: false, erro: "odoo" }, { status: 502 })
  }
}
