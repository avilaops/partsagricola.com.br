import { Metadata } from "next"
import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  CheckedProduct,
  Compatibility,
  Machine,
  SearchCode,
  TechnicalConfirmation,
} from "@modules/common/icons/parts"

export const metadata: Metadata = {
  title: "Confirmação técnica de peças",
  description:
    "Envie código, aplicação e dados da máquina para confirmar a peça correta antes de fechar o pedido.",
  alternates: {
    canonical: "/br/confirmacao-tecnica",
  },
}

const STEPS = [
  {
    icon: SearchCode,
    title: "Envie o que você já tem",
    description:
      "Código, foto, medidas ou referência gravada na peça ajudam a iniciar a análise.",
  },
  {
    icon: Machine,
    title: "Informe a aplicação",
    description:
      "Marca, modelo, ano e número de série reduzem o risco de incompatibilidade.",
  },
  {
    icon: CheckedProduct,
    title: "Receba a confirmação",
    description:
      "A equipe cruza os dados disponíveis antes de orientar a cotação e o pedido.",
  },
]

export default function ConfirmacaoTecnicaPage() {
  return (
    <main className="bg-[#f7faf8] pb-20">
      <section className="bg-[#101b17] text-white">
        <div className="content-container grid min-h-[620px] items-stretch medium:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-center py-16 pr-0 medium:py-24 medium:pr-12">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8fd1a9]">
              <TechnicalConfirmation aria-hidden="true" className="h-5 w-5" />
              Confirmação técnica
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight tracking-tight small:text-6xl">
              Confirme a peça antes de fechar o pedido
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">
              Nem sempre um código parecido significa a mesma aplicação. Envie
              os dados disponíveis para a equipe comparar peça, máquina e uso.
            </p>
            <div className="mt-8 flex flex-col gap-3 xsmall:flex-row">
              <LocalizedClientLink
                href="/contato?produto=Confirma%C3%A7%C3%A3o%20t%C3%A9cnica"
                className="inline-flex min-h-12 items-center justify-center rounded-rounded bg-white px-6 font-semibold text-[#0B6B3F] transition hover:bg-[#edf8f1]"
              >
                Solicitar confirmação →
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/store"
                className="inline-flex min-h-12 items-center justify-center rounded-rounded border border-white/25 px-6 font-semibold text-white transition hover:border-white/50 hover:bg-white/5"
              >
                Pesquisar no catálogo
              </LocalizedClientLink>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-white/60">
              <Compatibility aria-hidden="true" className="h-4 w-4" />A
              confirmação depende das informações enviadas e da aplicação.
            </p>
          </div>

          <div className="relative min-h-[360px] overflow-hidden medium:min-h-[620px]">
            <Image
              src="/images/campaigns/confirmacao-tecnica-v2.webp"
              alt="Componente mecânico em bancada de inspeção técnica com etiqueta e paquímetro"
              fill
              sizes="(min-width: 1024px) 52vw, 100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#101b17] via-transparent to-transparent medium:block" />
          </div>
        </div>
      </section>

      <section className="content-container py-16 small:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B6B3F]">
            Como funciona
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight small:text-4xl">
            Uma análise curta, com as informações certas
          </h2>
        </div>
        <ol className="mt-10 grid gap-5 medium:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <li
              key={title}
              className="border-t border-[#0B6B3F]/25 py-6 medium:pr-8"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eaf4ed] text-[#0B6B3F]">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <span className="font-mono text-sm text-ui-fg-muted">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold">{title}</h3>
              <p className="mt-3 leading-7 text-ui-fg-subtle">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="content-container">
        <div className="grid overflow-hidden rounded-[28px] bg-white shadow-[0_18px_60px_rgba(31,41,51,0.08)] medium:grid-cols-2">
          <div className="p-8 small:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B6B3F]">
              O que enviar
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Quanto melhor o contexto, melhor a orientação
            </h2>
          </div>
          <ul className="grid gap-px bg-ui-border-base xsmall:grid-cols-2">
            {[
              "Código ou foto da peça",
              "Marca e modelo da máquina",
              "Ano ou número de série",
              "Medidas e quantidade necessária",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 bg-white p-6">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2FBF71]" />
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="content-container pt-16">
        <div className="flex flex-col items-start justify-between gap-6 border-t border-ui-border-base pt-10 small:flex-row small:items-center">
          <div>
            <h2 className="text-2xl font-semibold">
              Já separou as informações?
            </h2>
            <p className="mt-2 text-ui-fg-subtle">
              Abra o atendimento e envie tudo em uma única mensagem.
            </p>
          </div>
          <LocalizedClientLink
            href="/contato?produto=Confirma%C3%A7%C3%A3o%20t%C3%A9cnica"
            className="inline-flex min-h-12 items-center justify-center rounded-rounded bg-[#0B6B3F] px-7 font-semibold text-white transition hover:bg-[#084f2f]"
          >
            Iniciar confirmação técnica →
          </LocalizedClientLink>
        </div>
      </section>
    </main>
  )
}
