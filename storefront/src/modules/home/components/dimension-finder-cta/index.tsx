import LocalizedClientLink from "@modules/common/components/localized-client-link"

const DimensionFinderCta = () => (
  <section className="bg-[#092f20] py-14 text-white small:py-18">
    <div className="content-container grid gap-8 small:grid-cols-[1fr_auto] small:items-center">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8fd1a9]">
          Busca de precisão
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight small:text-4xl">
          Já tem as medidas da vedação?
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/75">
          Encontre O-rings, retentores e gaxetas informando diâmetros, seção e
          altura. O resultado compara os campos técnicos, não apenas palavras.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-white/80">
          {["O-Rings", "Retentores", "Gaxetas e raspadores"].map((label) => (
            <span key={label} className="rounded-full border border-white/20 px-3 py-1.5">
              {label}
            </span>
          ))}
        </div>
      </div>
      <LocalizedClientLink
        href="/medidas"
        className="inline-flex h-12 items-center justify-center rounded-rounded bg-white px-7 font-semibold text-[#075b31] transition hover:bg-[#edf8f1]"
      >
        Buscar por medidas →
      </LocalizedClientLink>
    </div>
  </section>
)

export default DimensionFinderCta
