import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SearchAutocomplete from "@modules/search/components/search-autocomplete"

const QUICK_SEARCHES = [
  { label: "N273658", query: "N273658" },
  { label: "O-Rings", query: "O-Ring" },
  { label: "Retentores", query: "Retentor" },
  { label: "John Deere", query: "John Deere" },
]

const Hero = ({ countryCode }: { countryCode: string }) => {
  return (
    <div className="w-full border-b border-ui-border-base relative bg-[#0b6b3a] text-white">
      <div className="content-container py-20 small:py-28 flex flex-col items-center text-center gap-6">
        <span className="uppercase tracking-widest text-sm text-white/70">
          Peças agrícolas e de construção
        </span>
        <Heading
          level="h1"
          className="text-3xl small:text-5xl leading-tight font-semibold max-w-3xl"
        >
          O marketplace de peças para máquinas agrícolas e de construção
        </Heading>
        <Text className="text-white/80 max-w-2xl text-base small:text-lg">
          Peças agrícolas, máquinas pesadas e vedações industriais. Encontre
          pelo código, nome ou aplicação e solicite a confirmação técnica.
        </Text>

        <div className="mt-2 w-full max-w-2xl">
          <SearchAutocomplete countryCode={countryCode} variant="hero" />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-white/70">
            <span>Buscas rápidas:</span>
            {QUICK_SEARCHES.map((item) => (
              <LocalizedClientLink
                key={item.label}
                href={`/store?q=${encodeURIComponent(item.query)}`}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-white transition-colors hover:bg-white/20"
              >
                {item.label}
              </LocalizedClientLink>
            ))}
          </div>
        </div>

        <LocalizedClientLink
          href="/store"
          className="mt-2 inline-flex items-center gap-2 bg-white text-[#0b6b3a] font-semibold px-6 py-3 rounded-base hover:bg-white/90 transition-colors"
        >
          Ver catálogo completo
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default Hero
