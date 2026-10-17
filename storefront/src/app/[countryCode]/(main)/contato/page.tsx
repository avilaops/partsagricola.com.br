import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Participe do marketplace",
  description:
    "Cadastre sua empresa ou manifeste interesse em comprar pelo marketplace Parts Agrícola.",
  alternates: { canonical: "/br/contato" },
}

export default async function ContatoPage({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string }>
}) {
  const { perfil } = await searchParams
  const isCompany = perfil === "empresa"
  const profile = isCompany ? "empresa anunciante" : "comprador"
  const subject = encodeURIComponent(`Quero participar como ${profile}`)
  const body = encodeURIComponent(
    `Olá! Quero participar da Parts Agrícola como ${profile}.\n\nNome:\nEmpresa (se aplicável):\nCidade/UF:\nTelefone:`
  )
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(
    /\D/g,
    ""
  )
  const whatsappMessage = encodeURIComponent(
    `Olá! Quero participar da Parts Agrícola como ${profile}.`
  )

  return (
    <main className="bg-[#eef5f1] py-16 small:py-24">
      <div className="content-container max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pa-verde">
            Participe da nova plataforma
          </p>
          <h1 className="mt-4 text-4xl text-pa-grafite small:text-6xl">
            {isCompany
              ? "Leve sua empresa para o marketplace"
              : "Encontre empresas do agro em um só lugar"}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-ui-fg-subtle">
            {isCompany
              ? "Conte sobre sua empresa e seja avisado sobre o credenciamento de anunciantes."
              : "Conte o que você busca e seja avisado quando o acesso para compradores estiver disponível."}
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-2xl gap-4 xsmall:grid-cols-2">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-36 flex-col justify-between rounded-2xl bg-pa-verde p-6 text-white transition hover:-translate-y-0.5 hover:bg-[#08552e]"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                Atendimento direto
              </span>
              <strong className="text-xl">Falar no WhatsApp →</strong>
            </a>
          )}
          <a
            href={`mailto:contato@partsagricola.com.br?subject=${subject}&body=${body}`}
            className="flex min-h-36 flex-col justify-between rounded-2xl border border-ui-border-base bg-white p-6 transition hover:-translate-y-0.5 hover:border-pa-verde"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ui-fg-muted">
              E-mail
            </span>
            <strong className="text-xl text-pa-grafite">
              contato@partsagricola.com.br →
            </strong>
          </a>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-6 text-ui-fg-muted">
          A Parts Agrícola é a plataforma intermediadora. Produtos, anúncios e
          condições comerciais são de responsabilidade das empresas anunciantes.
        </p>
      </div>
    </main>
  )
}
