"use server"

import { buscarPorMedidas } from "./catalogo"

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

// Quais campos do formulário viram quais chaves da metadata, por tipo de
// peça — o mesmo contrato do formulário /medidas e da extração dos PDFs.
const CAMPOS: Record<
  TechnicalProductType,
  Array<[keyof TechnicalSearchInput, string]>
> = {
  oring: [
    ["internal", "internal_diameter_mm"],
    ["section", "section_mm"],
  ],
  retentor: [
    ["shaft", "shaft_mm"],
    ["external", "external_mm"],
    ["height", "height_mm"],
  ],
  gaxeta: [
    ["internal", "internal_mm"],
    ["external", "external_mm"],
    ["height", "height_mm"],
  ],
}

// Correspondência exata tem resultado pequeno por natureza; 500 é um teto de
// segurança, não uma expectativa.
const TETO = 500

export const searchProductsByDimensions = async (
  input: TechnicalSearchInput
): Promise<TechnicalSearchResponse> => {
  const medidas: Record<string, string> = {}
  for (const [campo, chave] of CAMPOS[input.type]) {
    const valor = input[campo]
    if (typeof valor === "string" && valor.trim()) {
      medidas[chave] = valor.trim()
    }
  }

  if (!Object.keys(medidas).length) {
    return { products: [], count: 0 }
  }

  const encontrados = await buscarPorMedidas(medidas, TETO)

  const limit = input.limit || 12
  const page = Math.max(1, input.page || 1)
  const janela = encontrados.slice((page - 1) * limit, page * limit)

  return {
    products: janela.map((produto) => ({
      id: produto.sku,
      title: produto.nome,
      handle: produto.handle ?? produto.sku,
      thumbnail: produto.imagemUrl,
      metadata: produto.metadata,
    })),
    count: encontrados.length,
  }
}
