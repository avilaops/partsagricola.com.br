import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  DimensionProductType,
  searchProductsByDimensionsWorkflow,
} from "../../../workflows/search-products-by-dimensions"

const PRODUCT_TYPES: DimensionProductType[] = ["oring", "retentor", "gaxeta"]

const readQueryValue = (value: unknown) =>
  typeof value === "string" ? value.trim() : ""

const normalizeDimension = (value: unknown) => {
  const rawValue = readQueryValue(value).replace(",", ".")

  if (!/^\d{1,5}(?:\.\d{1,3})?$/.test(rawValue)) {
    return undefined
  }

  const numericValue = Number(rawValue)
  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 10000) {
    return undefined
  }

  return String(numericValue)
}

const parsePositiveInteger = (
  value: unknown,
  fallback: number,
  maximum: number
) => {
  const parsed = Number.parseInt(readQueryValue(value), 10)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback
  }

  return Math.min(parsed, maximum)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const type = readQueryValue(req.query.type) as DimensionProductType
  if (!PRODUCT_TYPES.includes(type)) {
    return res.status(400).json({
      message: "Tipo de produto inválido.",
    })
  }

  const input = {
    type,
    internal: normalizeDimension(req.query.internal),
    section: normalizeDimension(req.query.section),
    shaft: normalizeDimension(req.query.shaft),
    external: normalizeDimension(req.query.external),
    height: normalizeDimension(req.query.height),
    page: parsePositiveInteger(req.query.page, 1, 1000),
    limit: parsePositiveInteger(req.query.limit, 12, 24),
  }

  const hasRequiredDimensions =
    (type === "oring" && input.internal && input.section) ||
    (type === "retentor" && input.shaft && input.external && input.height) ||
    (type === "gaxeta" && input.internal && input.external && input.height)

  if (!hasRequiredDimensions) {
    return res.status(400).json({
      message: "Informe todas as medidas necessárias em milímetros.",
    })
  }

  const { result } = await searchProductsByDimensionsWorkflow(req.scope).run({
    input,
  })

  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=300, stale-while-revalidate=600"
  )
  return res.json(result)
}
