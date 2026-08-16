import { Text } from "@medusajs/ui"

const STATS = [
  { value: "25,5 mil", label: "itens publicados" },
  { value: "24,7 mil", label: "códigos distintos" },
  { value: "4", label: "departamentos técnicos" },
  { value: "Busca técnica", label: "por código e aplicação" },
]

const TrustRow = () => {
  return (
    <div className="border-y border-ui-border-base bg-ui-bg-subtle">
      <div className="content-container py-10 grid grid-cols-2 small:grid-cols-4 gap-6">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <Text className="text-2xl small:text-3xl font-semibold text-[#0B6B3F]">
              {stat.value}
            </Text>
            <Text className="text-ui-fg-subtle text-sm mt-1">
              {stat.label}
            </Text>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrustRow
