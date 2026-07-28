import { Text } from "@medusajs/ui"

const STATS = [
  { value: "281+", label: "peças catalogadas" },
  { value: "100%", label: "peças originais Geomaq" },
  { value: "4", label: "linhas de máquinas" },
  { value: "Direto", label: "com quem monta o pedido" },
]

const TrustRow = () => {
  return (
    <div className="border-y border-ui-border-base bg-ui-bg-subtle">
      <div className="content-container py-10 grid grid-cols-2 small:grid-cols-4 gap-6">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <Text className="text-2xl small:text-3xl font-semibold text-[#0b6b3a]">
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
