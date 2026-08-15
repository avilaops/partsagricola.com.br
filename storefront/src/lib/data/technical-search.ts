"use server"

import { sdk } from "@lib/config"

export type TechnicalProductType = "oring" | "retentor" | "gaxeta"

export type TechnicalSearchInput = {
  type: TechnicalProductType
  internal?: string
  section?: string
  shaft?: string
  external?: string
  height?: string
  page?: number
  limit?: number
}

export type TechnicalSearchProduct = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  metadata: Record<string, unknown> | null
}

export type TechnicalSearchResponse = {
  products: TechnicalSearchProduct[]
  count: number
}

export const searchProductsByDimensions = async (
  input: TechnicalSearchInput
) =>
  sdk.client.fetch<TechnicalSearchResponse>("/store/technical-search", {
    method: "GET",
    query: {
      type: input.type,
      internal: input.internal,
      section: input.section,
      shaft: input.shaft,
      external: input.external,
      height: input.height,
      page: input.page || 1,
      limit: input.limit || 12,
    },
    cache: "no-store",
  })
