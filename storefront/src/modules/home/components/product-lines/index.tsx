import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const LINES = [
  {
    slug: "algodao",
    name: "Algodão",
    description:
      "Colhedoras de algodão — tambores, engrenagens, correias e componentes de coleta.",
  },
  {
    slug: "amendoim",
    name: "Amendoim",
    description:
      "Colhedoras de amendoim — correntes, turbinas e peças de recolhimento.",
  },
  {
    slug: "construcao",
    name: "Construção",
    description:
      "Máquinas de construção — rolamentos, coroas e pinhões, cardans e caçambas.",
  },
  {
    slug: "verde",
    name: "Verde",
    description:
      "Linha verde (tratores/implementos) — engrenagens, eixos e peças de corte de base.",
  },
]

const ProductLines = () => {
  return (
    <div className="content-container py-16">
      <div className="text-center mb-10">
        <Heading level="h2" className="text-2xl small:text-3xl font-semibold">
          Navegue por linha
        </Heading>
        <Text className="text-ui-fg-subtle mt-2">
          Catálogo organizado em 4 linhas
        </Text>
      </div>
      <div className="grid grid-cols-1 xsmall:grid-cols-2 small:grid-cols-4 gap-4">
        {LINES.map((line) => (
          <LocalizedClientLink
            key={line.slug}
            href={`/categories/${line.slug}`}
            className="group border border-ui-border-base rounded-large p-6 flex flex-col gap-3 hover:border-[#0b6b3a] hover:shadow-md transition-all bg-ui-bg-base"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-base bg-[#0b6b3a]/10 text-[#0b6b3a] font-bold">
              {line.name.charAt(0)}
            </span>
            <Text className="font-semibold text-ui-fg-base text-lg">
              {line.name}
            </Text>
            <Text className="text-ui-fg-subtle text-sm leading-relaxed">
              {line.description}
            </Text>
            <span className="text-[#0b6b3a] text-sm font-medium mt-auto group-hover:underline">
              Ver peças →
            </span>
          </LocalizedClientLink>
        ))}
      </div>
    </div>
  )
}

export default ProductLines
