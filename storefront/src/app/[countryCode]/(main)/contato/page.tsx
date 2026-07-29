import { Metadata } from "next"
import { Heading, Text } from "@medusajs/ui"

export const metadata: Metadata = {
  title: "Fale com a gente | Agricola",
  description:
    "Não achou a peça que precisa no catálogo? Fale com a gente pelo código, nome ou foto da peça.",
}

export default function ContatoPage() {
  return (
    <div className="content-container py-16 small:py-24 max-w-2xl mx-auto text-center">
      <Heading level="h1" className="text-2xl small:text-3xl font-semibold">
        Fale com a gente
      </Heading>
      <Text className="text-ui-fg-subtle mt-4">
        Procurando uma peça que não está no catálogo, ou precisa de
        ajuda para confirmar o código certo? Manda pra gente o código, nome ou
        até uma foto da peça que a gente confirma disponibilidade e ajuda a
        fechar o pedido.
      </Text>
      <a
        href="mailto:contato@agricola.avilaops.com"
        className="inline-flex items-center gap-2 mt-8 bg-[#0b6b3a] text-white font-semibold px-6 py-3 rounded-base hover:bg-[#0b6b3a]/90 transition-colors"
      >
        contato@agricola.avilaops.com
      </a>
    </div>
  )
}
