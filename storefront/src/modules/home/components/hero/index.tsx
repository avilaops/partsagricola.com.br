import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
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
          Algodão, Amendoim, Construção e Verde — encontre a peça certa pelo
          código de referência ou navegue pelo catálogo completo.
        </Text>

        <form
          action="/store"
          className="w-full max-w-xl flex mt-2 rounded-base overflow-hidden border border-white/20 bg-white/10 backdrop-blur"
        >
          <input
            type="text"
            name="q"
            placeholder="Buscar por código ou nome da peça (ex: N273658)"
            className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-white/60 outline-none"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-white text-[#0b6b3a] font-semibold hover:bg-white/90 transition-colors"
          >
            Buscar
          </button>
        </form>

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
