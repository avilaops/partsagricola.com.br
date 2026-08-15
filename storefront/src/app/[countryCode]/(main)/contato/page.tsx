import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contato e orçamento",
  description:
    "Solicite uma cotação de peças agrícolas, industriais e para máquinas pesadas com confirmação técnica.",
  alternates: {
    canonical: "/br/contato",
  },
}

export default async function ContatoPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string; produto?: string }>
}) {
  const { codigo, produto } = await searchParams
  const productLabel = produto || "Peça não localizada no catálogo"
  const codeLabel = codigo || "A confirmar"
  const message = [
    "Olá! Gostaria de solicitar uma cotação técnica.",
    `Produto: ${productLabel}`,
    `Código: ${codeLabel}`,
    "Pode confirmar aplicação, preço e disponibilidade?",
  ].join("\n")
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
    <main className="bg-[#f7faf8] py-16 small:py-24">
      <div className="content-container max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b6b3a]">
            Atendimento técnico
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight small:text-5xl">
            Solicite sua cotação
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ui-fg-subtle small:text-lg">
            Envie o código e os dados da aplicação. Nossa equipe confirma a
            peça correta, disponibilidade, prazo e condição comercial.
          </p>
        </div>

        {(codigo || produto) && (
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-[#0b6b3a]/20 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0b6b3a]">
              Item selecionado
            </p>
            <h2 className="mt-2 text-xl font-semibold">{productLabel}</h2>
            <p className="mt-2 font-mono text-sm text-ui-fg-subtle">
              Código {codeLabel}
            </p>
          </div>
        )}

        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-4 xsmall:grid-cols-2">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-32 flex-col justify-between rounded-2xl bg-[#0b6b3a] p-6 text-white transition-transform hover:-translate-y-0.5"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                Resposta rápida
              </span>
              <strong className="text-xl">Abrir WhatsApp →</strong>
            </a>
          )}
          <a
            href={emailHref}
            className="flex min-h-32 flex-col justify-between rounded-2xl border border-ui-border-base bg-white p-6 transition-transform hover:-translate-y-0.5 hover:border-[#0b6b3a]"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ui-fg-muted">
              Cotação por e-mail
            </span>
            <strong className="text-xl text-ui-fg-base">
              contato@partsagricola.com.br →
            </strong>
          </a>
        </div>

        <div className="mx-auto mt-10 max-w-2xl border-t border-ui-border-base pt-8">
          <h2 className="font-semibold">Para agilizar a confirmação, envie:</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 text-sm text-ui-fg-subtle xsmall:grid-cols-2">
            <li>• Código ou foto da peça</li>
            <li>• Marca e modelo da máquina</li>
            <li>• Ano ou número de série</li>
            <li>• Cidade de entrega e quantidade</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
