"use client"

import { useLeadOrigin } from "@modules/analytics/hooks/use-lead-origin"
import { Support, Whatsapp } from "@modules/common/icons/parts"
import { useEffect, useState } from "react"

/**
 * Os dois CTAs de cotacao da pagina de contato.
 *
 * Vive num componente de cliente so por causa da origem de campanha: ela mora
 * no `sessionStorage` e a pagina de contato e um Server Component. A alternativa
 * seria a mensagem chegar na caixa de entrada sem dizer de que anuncio veio —
 * justo nesta pagina, que e o destino mais provavel de um anuncio de "solicite
 * sua cotacao".
 */
export default function ContactCtas({
  productLabel,
  codeLabel,
  whatsappNumber,
}: {
  productLabel: string
  codeLabel: string
  whatsappNumber?: string
}) {
  const leadOrigin = useLeadOrigin()
  const message =
    [
      "Olá! Gostaria de solicitar uma cotação técnica.",
      `Produto: ${productLabel}`,
      `Código: ${codeLabel}`,
      "Pode confirmar aplicação, preço e disponibilidade?",
    ].join("\n") + leadOrigin

  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : undefined
  const [emailHref, setEmailHref] = useState("#email")
  const [emailLabel, setEmailLabel] = useState("Enviar cotação por e-mail →")

  useEffect(() => {
    const address = ["contato", "partsagricola.com.br"].join("@")
    setEmailHref(
      `mailto:${address}?subject=${encodeURIComponent(
        `Cotação da peça ${codeLabel}`
      )}&body=${encodeURIComponent(message)}`
    )
    setEmailLabel(`${address} →`)
  }, [codeLabel, message])

  return (
    <div
      className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-4 xsmall:grid-cols-2"
      data-lead-subject={`contato — ${codeLabel}`}
    >
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-32 flex-col justify-between rounded-2xl bg-[#0B6B3F] p-6 text-white transition-transform hover:-translate-y-0.5"
        >
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
            <Whatsapp aria-hidden="true" className="h-4 w-4" />
            Resposta rápida
          </span>
          <strong className="text-xl">Abrir WhatsApp →</strong>
        </a>
      )}
      <a
        href={emailHref}
        className="flex min-h-32 flex-col justify-between rounded-2xl border border-ui-border-base bg-white p-6 transition-transform hover:-translate-y-0.5 hover:border-[#0B6B3F]"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ui-fg-muted">
          <Support aria-hidden="true" className="h-4 w-4" />
          Cotação por e-mail
        </span>
        <strong className="text-xl text-ui-fg-base">{emailLabel}</strong>
      </a>
    </div>
  )
}
