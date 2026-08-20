import { Text } from "@medusajs/ui"
import React from "react"

import { IconProps } from "types/icon"
import {
  Category,
  Compatibility,
  Machine,
  TechnicalConfirmation,
} from "@modules/common/icons/parts"

/**
 * Números conferidos em 16/08/2026 no banco `agricola_medusa`.
 *
 * Estavam desatualizados desde a recuperação dos retentores: a home anunciava
 * 25,5 mil itens quando o catálogo já tinha 28,4 mil, e 4 departamentos quando
 * a barra do menu já mostrava 5. Número de vitrine que ninguém revisa envelhece
 * para baixo e trabalha contra — quem chega vê um catálogo menor do que o que
 * existe.
 */
const STATS: Array<{
  icone: React.FC<IconProps>
  value: string
  label: string
}> = [
  { icone: Category, value: "28,4 mil", label: "itens publicados" },
  { icone: Compatibility, value: "2,9 mil", label: "retentores por medida" },
  { icone: Machine, value: "4", label: "departamentos técnicos" },
  {
    icone: TechnicalConfirmation,
    value: "Confirmação",
    label: "técnica antes do pedido",
  },
]

const TrustRow = () => {
  return (
    <div className="border-y border-ui-border-base bg-ui-bg-subtle">
      <div className="content-container py-10 grid grid-cols-2 small:grid-cols-4 gap-6">
        {STATS.map(({ icone: Icone, value, label }) => (
          <div key={label} className="flex flex-col items-center text-center">
            <Icone aria-hidden="true" className="h-6 w-6 text-[#0B6B3F]" />
            <Text className="mt-2 text-2xl small:text-3xl font-semibold text-[#0B6B3F]">
              {value}
            </Text>
            <Text className="text-ui-fg-subtle text-sm mt-1">{label}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrustRow
