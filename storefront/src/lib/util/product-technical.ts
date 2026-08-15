import { HttpTypes } from "@medusajs/types"

type ProductMetadata = Record<string, unknown>

const metadataValue = (
  product: HttpTypes.StoreProduct,
  key: string
): string | undefined => {
  const value = (product.metadata as ProductMetadata | null)?.[key]
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
}

export const normalizeProductCode = (value?: string) =>
  value?.replace(/[^a-z0-9]/gi, "").toUpperCase() || ""

export const getProductCode = (product: HttpTypes.StoreProduct) => {
  const metadataCode = metadataValue(product, "source_code")
  if (metadataCode) {
    return metadataCode
  }

  const sku = product.variants?.find((variant) => variant.sku)?.sku
  if (sku) {
    return sku
  }

  const titleCode = product.title?.match(/—\s*([^—]+)$/)?.[1]?.trim()
  return titleCode || product.handle || product.id
}

export const getProductCompatibility = (product: HttpTypes.StoreProduct) =>
  product.title?.match(/\bComp\.\s*(.+?)(?:\s+—|$)/i)?.[1]?.trim()

export type TechnicalAttribute = {
  label: string
  value: string
}

export const getTechnicalAttributes = (
  product: HttpTypes.StoreProduct
): TechnicalAttribute[] => {
  const attributes: Array<TechnicalAttribute | undefined> = [
    { label: "Código", value: getProductCode(product) },
    metadataValue(product, "source_line")
      ? {
          label: "Linha ou aplicação",
          value: metadataValue(product, "source_line")!,
        }
      : undefined,
    getProductCompatibility(product)
      ? {
          label: "Compatibilidade informada",
          value: getProductCompatibility(product)!,
        }
      : undefined,
    metadataValue(product, "market_reference")
      ? {
          label: "Referência de mercado",
          value: metadataValue(product, "market_reference")!,
        }
      : undefined,
    metadataValue(product, "model")
      ? { label: "Modelo", value: metadataValue(product, "model")! }
      : undefined,
    metadataValue(product, "material") || product.material
      ? {
          label: "Material",
          value: metadataValue(product, "material") || product.material!,
        }
      : undefined,
    metadataValue(product, "internal_diameter_mm") ||
    metadataValue(product, "internal_mm")
      ? {
          label: "Diâmetro interno",
          value: `${
            metadataValue(product, "internal_diameter_mm") ||
            metadataValue(product, "internal_mm")
          } mm`,
        }
      : undefined,
    metadataValue(product, "external_mm")
      ? {
          label: "Diâmetro externo",
          value: `${metadataValue(product, "external_mm")} mm`,
        }
      : undefined,
    metadataValue(product, "shaft_mm")
      ? {
          label: "Diâmetro do eixo",
          value: `${metadataValue(product, "shaft_mm")} mm`,
        }
      : undefined,
    metadataValue(product, "section_mm")
      ? {
          label: "Seção",
          value: `${metadataValue(product, "section_mm")} mm`,
        }
      : undefined,
    metadataValue(product, "height_mm")
      ? {
          label: "Altura",
          value: `${metadataValue(product, "height_mm")} mm`,
        }
      : undefined,
    product.weight
      ? { label: "Peso", value: `${product.weight} g` }
      : undefined,
    product.categories?.[0]?.name
      ? { label: "Categoria", value: product.categories[0].name }
      : undefined,
  ]

  return attributes.filter(
    (attribute): attribute is TechnicalAttribute => Boolean(attribute?.value)
  )
}

export const hasExactProductCode = (
  product: HttpTypes.StoreProduct,
  code: string
) => normalizeProductCode(getProductCode(product)) === normalizeProductCode(code)
