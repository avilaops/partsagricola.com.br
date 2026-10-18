import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

const buyerBenefits = [
  "Encontre empresas especializadas no setor agrícola",
  "Compare anúncios, condições e fornecedores",
  "Converse com a empresa antes de fechar negócio",
]

const sellerBenefits = [
  "Crie a presença digital da sua empresa",
  "Publique e gerencie seus próprios anúncios",
  "Receba oportunidades de compradores de todo o Brasil",
]

const steps = [
  {
    number: "01",
    title: "Empresas anunciam",
    description:
      "Cada anunciante publica e mantém suas próprias ofertas, informações e condições comerciais.",
  },
  {
    number: "02",
    title: "Compradores encontram",
    description:
      "A busca conecta a necessidade do comprador a empresas que atendem aquele mercado.",
  },
  {
    number: "03",
    title: "O negócio acontece",
    description:
      "Comprador e empresa conversam, esclarecem detalhes e avançam na negociação pela plataforma.",
  },
]

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mt-0.5 h-5 w-5 shrink-0"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".12" />
      <path
        d="m7.5 12.2 3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function MarketplaceHome() {
  return (
    <>
      <section className="overflow-hidden bg-[#0d3525] text-white">
        <div className="content-container grid min-h-[660px] items-center gap-12 py-16 medium:grid-cols-[1.02fr_0.98fr] medium:py-24">
          <div className="relative z-10 max-w-3xl">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#a9e6c0]">
              Marketplace B2B do agro
            </p>
            <h1 className="mt-7 text-4xl font-extrabold leading-[1.05] tracking-[-0.045em] small:text-6xl medium:text-7xl">
              O mercado das empresas do agro.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75 small:text-xl">
              A Parts Agrícola conecta empresas anunciantes a compradores. Aqui,
              quem vende é a empresa — a plataforma aproxima, organiza e
              facilita o negócio.
            </p>
            <div className="mt-9 flex flex-col gap-3 xsmall:flex-row">
              <LocalizedClientLink
                href="/contato?perfil=comprador"
                className="inline-flex min-h-14 items-center justify-center rounded-xl bg-[#2fbf71] px-7 font-semibold text-[#082519] transition hover:bg-[#58d58d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Quero comprar
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/contato?perfil=empresa"
                className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/30 bg-white/5 px-7 font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Anunciar como empresa
              </LocalizedClientLink>
            </div>
            <p className="mt-5 text-sm text-white/55">
              Sem estoque próprio. Sem catálogo da plataforma. Anúncios
              publicados pelas empresas participantes.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-2xl">
            <div className="absolute -inset-10 rounded-full bg-[#2fbf71]/20 blur-3xl" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] border border-white/15 bg-[#174b36] shadow-2xl">
              <Image
                src="/images/marketplace/hero-marketplace-mobile.webp"
                alt="Empresas independentes conectadas ao marketplace Parts Agrícola"
                fill
                priority
                sizes="100vw"
                className="object-cover medium:hidden"
              />
              <Image
                src="/images/marketplace/rede-fornecedores.webp"
                alt="Empresas do setor agrícola conectadas pelo marketplace Parts Agrícola"
                fill
                priority
                sizes="(min-width: 1280px) 46vw, 100vw"
                className="hidden object-cover object-[38%_center] opacity-90 medium:block"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#082519]/80 via-transparent to-transparent" />
              <div className="absolute inset-x-5 bottom-5 grid grid-cols-2 gap-3 small:inset-x-7 small:bottom-7">
                <div className="rounded-2xl border border-white/15 bg-[#082519]/80 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/55">
                    Quem anuncia
                  </p>
                  <p className="mt-1 font-semibold">Empresas verificadas</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-[#082519]/80 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/55">
                    Quem compra
                  </p>
                  <p className="mt-1 font-semibold">Produtores e negócios</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-white py-16 small:py-24">
        <div className="content-container">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pa-verde">
              Como funciona
            </p>
            <h2 className="mt-4 text-3xl text-pa-grafite small:text-5xl">
              Uma plataforma. Muitas empresas. Mais oportunidades.
            </h2>
          </div>
          <ol className="mt-12 grid gap-4 medium:grid-cols-3">
            {steps.map((step) => (
              <li
                key={step.number}
                className="rounded-[24px] border border-ui-border-base bg-pa-superficie p-7 small:p-8"
              >
                <span className="font-mono text-sm font-semibold text-pa-verde">
                  {step.number}
                </span>
                <h3 className="mt-8 text-2xl text-pa-grafite">{step.title}</h3>
                <p className="mt-3 leading-7 text-ui-fg-subtle">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#eef5f1] py-16 small:py-24">
        <div className="content-container grid gap-6 medium:grid-cols-2">
          <article className="rounded-[28px] bg-white p-7 shadow-sm small:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pa-verde">
              Para compradores
            </p>
            <h2 className="mt-4 text-3xl text-pa-grafite small:text-4xl">
              Encontre quem pode atender você
            </h2>
            <ul className="mt-7 space-y-4">
              {buyerBenefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 text-ui-fg-subtle">
                  <CheckIcon />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <LocalizedClientLink
              href="/contato?perfil=comprador"
              className="mt-9 inline-flex min-h-12 items-center justify-center rounded-xl bg-pa-verde px-6 font-semibold text-white hover:bg-[#08552e]"
            >
              Entrar como comprador
            </LocalizedClientLink>
          </article>

          <article
            id="para-empresas"
            className="rounded-[28px] bg-[#14221c] p-7 text-white shadow-sm small:p-10"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8fd1a9]">
              Para empresas anunciantes
            </p>
            <h2 className="mt-4 text-3xl small:text-4xl">
              Transforme seu estoque em oportunidade
            </h2>
            <ul className="mt-7 space-y-4">
              {sellerBenefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 text-white/75">
                  <CheckIcon />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <LocalizedClientLink
              href="/contato?perfil=empresa"
              className="mt-9 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2fbf71] px-6 font-semibold text-[#082519] hover:bg-[#58d58d]"
            >
              Cadastrar minha empresa
            </LocalizedClientLink>
          </article>
        </div>
      </section>

      <section className="bg-white py-16 small:py-24">
        <div className="content-container">
          <div className="rounded-[28px] border border-ui-border-base bg-pa-superficie px-7 py-12 text-center small:px-12 small:py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pa-verde">
              Nova Parts Agrícola
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl text-3xl text-pa-grafite small:text-5xl">
              O catálogo próprio saiu. O marketplace das empresas começa aqui.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl leading-7 text-ui-fg-subtle">
              Estamos credenciando empresas e compradores para a nova
              plataforma. Escolha seu perfil e fale com a equipe.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 xsmall:flex-row">
              <LocalizedClientLink
                href="/contato?perfil=empresa"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-pa-verde px-6 font-semibold text-white hover:bg-[#08552e]"
              >
                Sou uma empresa
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/contato?perfil=comprador"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-pa-verde px-6 font-semibold text-pa-verde hover:bg-white"
              >
                Sou comprador
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
