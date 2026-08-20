"use client"

import { useState } from "react"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { getLeadOrigin, pushDataLayer } from "@lib/util/analytics"
import { useLeadOrigin } from "@modules/analytics/hooks/use-lead-origin"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { useQuoteList } from "@modules/quote-list/context/quote-list-context"
import { Close, QuoteList } from "@modules/common/icons/parts/complementos"

const getAbsoluteUrl = (url: string) => {
  if (url.startsWith("http")) {
    return url
  }

  return typeof window === "undefined" ? url : `${window.location.origin}${url}`
}

type Envio =
  | { estado: "parado" }
  | { estado: "enviando" }
  | { estado: "sucesso"; pedido: string | null }
  | { estado: "erro"; motivo: "campos" | "indisponivel" }

const QuoteListDrawer = ({ whatsappNumber }: { whatsappNumber?: string }) => {
  const { items, isOpen, closeList, removeItem, updateQuantity, clearItems } =
    useQuoteList()
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0)
  // Campanha que trouxe a pessoa, quando houver. A venda fecha fora do site:
  // sem isso o pedido chega na caixa de entrada sem dizer de onde veio.
  const leadOrigin = useLeadOrigin()

  const [nome, setNome] = useState("")
  const [contato, setContato] = useState("")
  // Honeypot: humano não vê nem preenche; bot que preencher é descartado no
  // servidor com um "ok" de mentira.
  const [site, setSite] = useState("")
  const [envio, setEnvio] = useState<Envio>({ estado: "parado" })

  const enviarParaEquipe = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nomeLimpo = nome.trim()
    const contatoLimpo = contato.trim()
    if (nomeLimpo.length < 2 || contatoLimpo.length < 6) {
      setEnvio({ estado: "erro", motivo: "campos" })
      return
    }

    // Um campo só para os dois canais: quem digita @ deu e-mail, o resto é
    // telefone. Pedir os dois separados dobraria o formulário para nada.
    const email = contatoLimpo.includes("@") ? contatoLimpo : null
    const whatsapp = email ? null : contatoLimpo

    setEnvio({ estado: "enviando" })
    try {
      const resposta = await fetch("/api/cotacao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: nomeLimpo,
          email,
          whatsapp,
          site,
          origem: leadOrigin || null,
          itens: items.map((item) => ({
            handle: item.handle,
            code: item.code,
            title: item.title,
            quantity: item.quantity,
          })),
        }),
      })
      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok || !corpo?.ok) {
        setEnvio({
          estado: "erro",
          motivo: resposta.status === 400 ? "campos" : "indisponivel",
        })
        return
      }

      const origem = getLeadOrigin()
      pushDataLayer({
        event: "generate_lead",
        lead_source: "formulario_cotacao",
        page_path: window.location.pathname,
        ...(origem?.utm_source ? { utm_source: origem.utm_source } : {}),
        ...(origem?.utm_medium ? { utm_medium: origem.utm_medium } : {}),
        ...(origem?.utm_campaign ? { utm_campaign: origem.utm_campaign } : {}),
      })

      setEnvio({ estado: "sucesso", pedido: corpo.pedido ?? null })
      clearItems()
    } catch {
      setEnvio({ estado: "erro", motivo: "indisponivel" })
    }
  }

  const message =
    [
      "Olá! Gostaria de solicitar uma cotação técnica para os itens abaixo:",
      "",
      ...items.flatMap((item, index) => [
        `${index + 1}. ${item.code} — ${item.title}`,
        `Quantidade: ${item.quantity}`,
        `Link: ${getAbsoluteUrl(item.url)}`,
        "",
      ]),
      "Pode confirmar aplicação, preço, disponibilidade, prazo e frete?",
    ].join("\n") + leadOrigin
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : undefined
  const emailHref = `mailto:contato@partsagricola.com.br?subject=${encodeURIComponent(
    `Cotação técnica de ${items.length} ${
      items.length === 1 ? "item" : "itens"
    }`
  )}&body=${encodeURIComponent(message)}`

  return (
    <Dialog open={isOpen} onClose={closeList} className="relative z-[80]">
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex justify-end">
        <DialogPanel className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-[#0B6B3F] px-6 py-6 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Atendimento técnico
              </p>
              <DialogTitle className="mt-1 text-2xl font-semibold">
                Lista de cotação
              </DialogTitle>
              <p className="mt-1 text-sm text-white/75">
                {items.length} {items.length === 1 ? "peça" : "peças"} ·{" "}
                {totalQuantity} {totalQuantity === 1 ? "unidade" : "unidades"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeList}
              className="rounded-full border border-white/25 p-2 transition-colors hover:bg-white/10"
              aria-label="Fechar lista de cotação"
            >
              <Close aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          {envio.estado === "sucesso" ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e7f3eb] text-[#0B6B3F]">
                <QuoteList aria-hidden="true" className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">Cotação registrada</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ui-fg-subtle">
                {envio.pedido ? (
                  <>
                    Seu pedido de cotação é o{" "}
                    <strong className="font-mono text-ui-fg-base">
                      {envio.pedido}
                    </strong>
                    . Nossa equipe confirma aplicação, preço, disponibilidade e
                    prazo pelo contato informado.
                  </>
                ) : (
                  "Nossa equipe confirma aplicação, preço, disponibilidade e prazo pelo contato informado."
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEnvio({ estado: "parado" })
                  closeList()
                }}
                className="mt-6 rounded-base bg-[#0B6B3F] px-6 py-3 text-sm font-semibold text-white"
              >
                Continuar no catálogo
              </button>
            </div>
          ) : items.length ? (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-2">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="grid grid-cols-[72px_1fr] gap-4 border-b border-ui-border-base py-5"
                  >
                    <LocalizedClientLink
                      href={`/products/${item.handle}`}
                      onClick={closeList}
                      className="block overflow-hidden rounded-xl border border-ui-border-base bg-[#f7faf8]"
                    >
                      <Thumbnail thumbnail={item.thumbnail} size="square" />
                    </LocalizedClientLink>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-semibold text-[#0B6B3F]">
                            {item.code}
                          </p>
                          <LocalizedClientLink
                            href={`/products/${item.handle}`}
                            onClick={closeList}
                            className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ui-fg-base hover:text-[#0B6B3F]"
                          >
                            {item.title}
                          </LocalizedClientLink>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="shrink-0 text-xs text-ui-fg-muted hover:text-red-600"
                        >
                          Remover
                        </button>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-ui-fg-subtle">
                          Quantidade
                        </span>
                        <div className="flex items-center rounded-full border border-ui-border-base bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="h-8 w-8 text-sm hover:text-[#0B6B3F]"
                            aria-label={`Diminuir quantidade de ${item.title}`}
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="h-8 w-8 text-sm hover:text-[#0B6B3F]"
                            aria-label={`Aumentar quantidade de ${item.title}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="border-t border-ui-border-base bg-[#f7faf8] p-5">
                <form onSubmit={enviarParaEquipe} noValidate>
                  <p className="text-xs leading-relaxed text-ui-fg-subtle">
                    Envie a lista e receba a confirmação de compatibilidade,
                    disponibilidade, prazo e frete.
                  </p>
                  <input
                    type="text"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    name="site"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  />
                  <div className="mt-3 grid gap-2">
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome"
                      autoComplete="name"
                      className="min-h-11 rounded-base border border-ui-border-base bg-white px-4 text-sm outline-none focus:border-[#0B6B3F]"
                      data-testid="quote-form-name"
                    />
                    <input
                      type="text"
                      value={contato}
                      onChange={(e) => setContato(e.target.value)}
                      placeholder="E-mail ou WhatsApp"
                      autoComplete="email"
                      inputMode="email"
                      className="min-h-11 rounded-base border border-ui-border-base bg-white px-4 text-sm outline-none focus:border-[#0B6B3F]"
                      data-testid="quote-form-contact"
                    />
                  </div>
                  {envio.estado === "erro" && (
                    <p className="mt-2 text-xs text-red-700" role="alert">
                      {envio.motivo === "campos"
                        ? "Confira o nome e um e-mail ou WhatsApp válidos."
                        : "Não foi possível registrar agora — envie pelo WhatsApp logo abaixo."}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={envio.estado === "enviando"}
                    className="mt-3 flex min-h-12 w-full items-center justify-center rounded-base bg-[#0B6B3F] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#08552e] disabled:opacity-60"
                    data-testid="quote-form-submit"
                  >
                    {envio.estado === "enviando"
                      ? "Enviando…"
                      : "Enviar cotação para nossa equipe"}
                  </button>
                </form>

                <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-4">
                    {whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-[#0B6B3F] hover:underline"
                        data-testid="quote-list-whatsapp-button"
                      >
                        Pelo WhatsApp
                      </a>
                    )}
                    <a
                      href={emailHref}
                      className="font-medium text-[#0B6B3F] hover:underline"
                    >
                      Por e-mail
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={clearItems}
                    className="text-ui-fg-muted hover:text-red-600"
                  >
                    Limpar lista
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e7f3eb] text-[#0B6B3F]">
                <QuoteList aria-hidden="true" className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">
                Sua lista está vazia
              </h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ui-fg-subtle">
                Adicione as peças que precisa e envie tudo em uma única
                solicitação.
              </p>
              <LocalizedClientLink
                href="/store"
                onClick={closeList}
                className="mt-6 rounded-base bg-[#0B6B3F] px-6 py-3 text-sm font-semibold text-white"
              >
                Explorar catálogo
              </LocalizedClientLink>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export default QuoteListDrawer
