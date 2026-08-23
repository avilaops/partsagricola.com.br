import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SearchAutocomplete from "@modules/search/components/search-autocomplete"

// Poucos atalhos, os que o comprador realmente digita: um código de exemplo,
// duas famílias e uma marca. Mais que isso vira ruído abaixo da busca.
const QUICK_SEARCHES = [
  { label: "N273658", query: "N273658" },
  { label: "O-Rings", query: "O-Ring" },
  { label: "Retentores", query: "Retentor" },
  { label: "John Deere", query: "John Deere", aplicacao: true },
]

/**
 * Hero limpo: fundo branco, um título curto, a busca como protagonista.
 *
 * A versão anterior era um bloco verde cheio com título de quatro linhas no
 * celular — pesado e com a busca empurrada para baixo da dobra. Aqui a
 * hierarquia é: o que você procura (busca), como procurar (chips) e só então
 * o resto da página (departamentos, novidades, confirmação técnica).
 */
const Hero = ({ countryCode }: { countryCode: string }) => {
  return (
    <section className="w-full border-b border-ui-border-base bg-white">
      <div className="content-container flex flex-col items-center py-12 text-center small:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pa-verde">
          Peças agrícolas, máquinas pesadas e vedações
        </p>
        <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-pa-grafite small:text-5xl">
          Encontre a peça certa pelo código, nome ou aplicação
        </h1>
        <p className="mt-4 max-w-xl text-base text-ui-fg-subtle small:text-lg">
          28 mil peças com ficha técnica. Monte sua lista e peça a confirmação
          técnica em um clique.
        </p>

        <div className="mt-8 w-full max-w-2xl">
          <SearchAutocomplete countryCode={countryCode} variant="hero" />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-ui-fg-muted">Buscas rápidas:</span>
            {QUICK_SEARCHES.map((item) => (
              <LocalizedClientLink
                key={item.label}
                href={
                  item.aplicacao
                    ? `/aplicacoes/${item.query.toLowerCase().replace(/\s+/g, "-")}`
                    : `/store?q=${encodeURIComponent(item.query)}`
                }
                className="rounded-full border border-ui-border-base bg-pa-superficie px-3 py-1.5 text-ui-fg-base transition-colors hover:border-pa-verde hover:text-pa-verde"
              >
                {item.label}
              </LocalizedClientLink>
            ))}
          </div>
        </div>

        <LocalizedClientLink
          href="/store"
          className="mt-8 text-sm font-semibold text-pa-verde hover:underline"
        >
          Ver catálogo completo →
        </LocalizedClientLink>
      </div>
    </section>
  )
}

export default Hero
