"use client"

import { useLeadOrigin } from "@modules/analytics/hooks/use-lead-origin"

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
}: {
  productLabel: string
  codeLabel: string
}) {
  const leadOrigin = useLeadOrigin()
  const message =
    [
      "Olá! Gostaria de solicitar uma cotação técnica.",
      `Produto: ${productLabel}`,
      `Código: ${codeLabel}`,
      "Pode confirmar aplicação, preço e disponibilidade?",
    ].join("\n") + leadOrigin

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(
    /\D/g,
    ""
  )
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : undefined
  const emailHref = `mailto:contato@partsagricola.com.br?subject=${encodeURIComponent(
    `Cotação da peça ${codeLabel}`
  )}&body=${encodeURIComponent(message)}`

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
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
            Resposta rápida
          </span>
          <strong className="text-xl">Abrir WhatsApp →</strong>
        </a>
      )}
      <a
        href={emailHref}
        className="flex min-h-32 flex-col justify-between rounded-2xl border border-ui-border-base bg-white p-6 transition-transform hover:-translate-y-0.5 hover:border-[#0B6B3F]"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ui-fg-muted">
          Cotação por e-mail
        </span>
        <strong className="text-xl text-ui-fg-base">
          contato@partsagricola.com.br →
        </strong>
      </a>
    </div>
  )
}
