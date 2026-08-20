import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  Compatibility,
  TechnicalConfirmation,
} from "@modules/common/icons/parts"

const CtaBanner = () => {
  return (
    <section className="content-container pb-12 small:pb-20">
      <div className="grid overflow-hidden rounded-[28px] bg-[#101b17] text-white medium:grid-cols-[1fr_0.9fr]">
        <div className="flex flex-col justify-center p-7 small:p-10 medium:p-14">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8fd1a9]">
            <TechnicalConfirmation aria-hidden="true" className="h-5 w-5" />
            Segurança na aplicação
          </p>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight small:text-4xl">
            Encontrou uma peça, mas ainda tem dúvida?
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/75">
            Envie código, foto e dados da máquina. A confirmação técnica ajuda a
            comparar a aplicação antes de orientar a cotação.
          </p>
          <p className="mt-5 flex items-center gap-2 text-sm text-white/60">
            <Compatibility aria-hidden="true" className="h-4 w-4" />
            Código parecido não garante compatibilidade.
          </p>
          <div className="mt-8">
            <LocalizedClientLink
              href="/confirmacao-tecnica"
              className="inline-flex min-h-12 items-center justify-center rounded-rounded bg-white px-6 font-semibold text-[#0B6B3F] transition hover:bg-[#edf8f1]"
            >
              Entender a confirmação →
            </LocalizedClientLink>
          </div>
        </div>
        <div className="relative hidden min-h-[420px] medium:block">
          <Image
            src="/images/campaigns/confirmacao-tecnica-v2.webp"
            alt="Componente mecânico em bancada de inspeção técnica"
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#101b17]/70 via-transparent to-transparent" />
        </div>
      </div>
    </section>
  )
}

export default CtaBanner
