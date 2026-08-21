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

// Limite de taxa por IP, em memória: 5 cotações a cada 10 minutos. Uma
// cotação vira registro no ERP, então um script enchendo o formulário
// enche o Odoo. Em memória basta: o storefront é um processo só, e quem
// estourar recebe 429 com retry — humano nenhum manda 6 cotações em 10 min.
const JANELA_MS = 10 * 60 * 1000
const MAX_POR_JANELA = 5
const tentativas = new Map<string, number[]>()

function estourouLimite(ip: string): boolean {
  const agora = Date.now()
  const recentes = (tentativas.get(ip) ?? []).filter((t) => agora - t < JANELA_MS)
  recentes.push(agora)
  tentativas.set(ip, recentes)
  // limpeza preguiçosa para o mapa não crescer para sempre
  if (tentativas.size > 5000) {
    Array.from(tentativas.entries()).forEach(([chave, lista]) => {
      if (!lista.some((t: number) => agora - t < JANELA_MS)) tentativas.delete(chave)
    })
  }
  return recentes.length > MAX_POR_JANELA
}

function ipDe(requisicao: Request): string {
  // Atrás da Cloudflare e do Caddy o IP real vem nestes cabeçalhos.
  return (
    requisicao.headers.get("cf-connecting-ip") ||
    requisicao.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "desconhecido"
  )
}

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

// Webhook do n8n que avisa a equipe (fluxo "PartsAgrícola — aviso de nova
// cotação"). Sem URL/token configurados, simplesmente não avisa — falha muda.
function avisarEquipe(carga: Record<string, unknown>): void {
  const url = process.env.COTACAO_WEBHOOK_URL
  const token = process.env.COTACAO_WEBHOOK_TOKEN
  if (!url || !token) return
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Cotacao-Token": token },
    body: JSON.stringify(carga),
    signal: AbortSignal.timeout(8000),
  }).catch((erro) => {
    console.error("[cotacao] aviso à equipe falhou:", erro?.message ?? erro)
  })
}

export async function POST(requisicao: Request) {
  if (!cotacaoOdooDisponivel()) {
    // Ambiente sem as credenciais (dev local, deploy incompleto): o cliente
    // ainda tem WhatsApp e e-mail — a resposta diz isso em vez de estourar.
    return NextResponse.json(
      { ok: false, erro: "indisponivel" },
      { status: 503 }
    )
  }

  if (estourouLimite(ipDe(requisicao))) {
    return NextResponse.json(
      { ok: false, erro: "limite" },
      { status: 429, headers: { "Retry-After": "600" } }
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
    // Aviso à equipe via n8n (e-mail), sem bloquear a resposta: o orçamento
    // já está no Odoo; se o aviso falhar, o que se perde é a urgência, não o
    // pedido — e o cliente não espera o SMTP de ninguém.
    avisarEquipe({
      pedido,
      nome,
      email,
      whatsapp,
      mensagem,
      itens: itens.map((i) => ({
        sku: (i.handle && skus.get(i.handle)) || i.codigo,
        titulo: i.titulo,
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
