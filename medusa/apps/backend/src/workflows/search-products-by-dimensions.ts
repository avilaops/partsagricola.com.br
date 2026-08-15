import type { IProductModuleService } from "@medusajs/framework/types"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules, ProductStatus } from "@medusajs/framework/utils"

export type DimensionProductType = "oring" | "retentor" | "gaxeta"

export type SearchProductsByDimensionsInput = {
  type: DimensionProductType
  internal?: string
  section?: string
  shaft?: string
  external?: string
  height?: string
  page: number
  limit: number
}

type ProductMetadataFilter = Record<string, string>

const buildMetadataFilter = ({
  type,
  internal,
  section,
  shaft,
  external,
  height,
}: SearchProductsByDimensionsInput): ProductMetadataFilter => {
  if (type === "oring") {
    return {
      source: "orings",
      internal_diameter_mm: internal!,
      section_mm: section!,
    }
  }

  if (type === "retentor") {
    return {
      source: "retentores",
      shaft_mm: shaft!,
      external_mm: external!,
      height_mm: height!,
    }
  }

  return {
    source: "gaxetas_raspadores",
    internal_mm: internal!,
    external_mm: external!,
    height_mm: height!,
  }
}

const searchProductsByDimensionsStep = createStep(
  "search-products-by-dimensions",
  async (input: SearchProductsByDimensionsInput, { container }) => {
    const productService: IProductModuleService = container.resolve(
      Modules.PRODUCT
    )
    const metadata = buildMetadataFilter(input)
    const [products, count] = await productService.listAndCountProducts(
      {
        status: ProductStatus.PUBLISHED,
        metadata,
      } as Parameters<IProductModuleService["listAndCountProducts"]>[0],
      {
        select: ["id", "title", "handle", "thumbnail", "metadata"],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }
    )

    return new StepResponse({ products, count })
  }
)

export const searchProductsByDimensionsWorkflow = createWorkflow(
  "search-products-by-dimensions",
  (input: SearchProductsByDimensionsInput) => {
    const result = searchProductsByDimensionsStep(input)

    return new WorkflowResponse(result)
  }
)
