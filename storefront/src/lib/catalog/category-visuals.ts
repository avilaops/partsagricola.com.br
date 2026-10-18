import type { HttpTypes } from "@medusajs/types"

export type CategoryVisual = {
  image: string
  imageAlt: string
  eyebrow: string
  surfaceClass: string
}

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  "pecas-agricolas": {
    image: "/images/departments/pecas-agricolas-v2.webp",
    imageAlt:
      "Engrenagem, rolamentos, filtros e componentes para máquinas agrícolas",
    eyebrow: "Plantio, colheita e implementos",
    surfaceClass: "bg-[#eaf4ed]",
  },
  "maquinas-pesadas": {
    image: "/images/departments/maquinas-pesadas-v2.webp",
    imageAlt:
      "Conjunto de esteira, roda motriz e cilindro hidráulico de máquina pesada",
    eyebrow: "Construção, terraplenagem e rodante",
    surfaceClass: "bg-[#fff2e4]",
  },
  "vedacoes-e-selagem": {
    image: "/images/departments/vedacoes-e-selagem-v2.webp",
    imageAlt: "Conjunto de vedações, retentores e componentes hidráulicos",
    eyebrow: "Vedação hidráulica e industrial",
    surfaceClass: "bg-[#eaf1fb]",
  },
  "kits-e-reparos": {
    image: "/images/departments/kits-e-reparos-v2.webp",
    imageAlt: "Kit técnico de reparo com ferramentas e componentes de precisão",
    eyebrow: "Manutenção e recuperação de conjuntos",
    surfaceClass: "bg-[#f1eef9]",
  },
  "rolamentos-e-transmissao": {
    image: "/images/departments/rolamentos-e-transmissao-v2.webp",
    imageAlt:
      "Rolamento de esferas, mancal flangeado, correia e corrente de rolos",
    eyebrow: "Rolamentos, correias, correntes e transmissão",
    surfaceClass: "bg-[#fbeeee]",
  },
}

/**
 * Uma subcategoria herda o visual do departamento pai. Assim a taxonomia pode
 * crescer sem exigir uma arte duplicada para cada linha técnica.
 */
export function getCategoryVisual(
  category: HttpTypes.StoreProductCategory
): CategoryVisual | undefined {
  let current: HttpTypes.StoreProductCategory | null | undefined = category

  while (current) {
    if (current.handle && CATEGORY_VISUALS[current.handle]) {
      return CATEGORY_VISUALS[current.handle]
    }

    current = current.parent_category
  }

  return undefined
}
