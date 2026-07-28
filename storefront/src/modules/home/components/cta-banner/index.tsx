import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const CtaBanner = () => {
  return (
    <div className="content-container pb-16">
      <div className="rounded-large bg-[#0b6b3a] text-white px-8 py-12 small:px-16 small:py-16 flex flex-col small:flex-row items-center justify-between gap-6">
        <div className="text-center small:text-left">
          <Heading level="h2" className="text-2xl small:text-3xl font-semibold">
            Não achou a peça?
          </Heading>
          <Text className="text-white/80 mt-2 max-w-md">
            Fale com a gente pelo código, nome ou foto da peça — a gente
            confirma disponibilidade e te ajuda a fechar o pedido.
          </Text>
        </div>
        <LocalizedClientLink
          href="/contato"
          className="whitespace-nowrap inline-flex items-center gap-2 bg-white text-[#0b6b3a] font-semibold px-6 py-3 rounded-base hover:bg-white/90 transition-colors"
        >
          Falar com a gente
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default CtaBanner
