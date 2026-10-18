import Image from "next/image"

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
      <div className="content-container grid items-center gap-10 py-10 small:py-16 medium:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] medium:gap-12">
        <div className="text-center medium:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pa-verde">
            Marketplace de peças agrícolas, máquinas pesadas e vedações
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-pa-grafite small:text-5xl">
            Encontre a peça certa entre fornecedores especializados
          </h1>
          <p className="mt-4 max-w-xl text-base text-ui-fg-subtle small:text-lg">
            Os vendedores publicam e gerenciam seus próprios produtos. Você
            pesquisa, compara as opções e confirma a aplicação antes de fechar
            negócio.
          </p>

          <div className="mt-8 w-full max-w-2xl">
            <SearchAutocomplete countryCode={countryCode} variant="hero" />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm medium:justify-start">
              <span className="text-ui-fg-muted">Buscas rápidas:</span>
              {QUICK_SEARCHES.map((item) => (
                <LocalizedClientLink
                  key={item.label}
                  href={
                    item.aplicacao
                      ? `/aplicacoes/${item.query
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`
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
            className="mt-8 inline-flex text-sm font-semibold text-pa-verde hover:underline"
          >
            Ver catálogo do marketplace →
          </LocalizedClientLink>
        </div>

        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-ui-border-base bg-pa-superficie shadow-sm small:aspect-[16/10]">
          <Image
            src="/images/marketplace/hero-marketplace-mobile.webp"
            alt="Estoques de vendedores conectados à plataforma Parts Agrícola"
            fill
            priority
            sizes="(min-width: 768px) 0px, 100vw"
            className="object-cover medium:hidden"
          />
          <Image
            src="/images/marketplace/hero-marketplace.webp"
            alt="Estoques de vendedores especializados conectados à plataforma Parts Agrícola"
            fill
            priority
            sizes="(min-width: 1024px) 44vw, 100vw"
            className="hidden object-cover object-[72%_center] medium:block"
          />
        </div>
      </div>
    </section>
  )
}

export default Hero
