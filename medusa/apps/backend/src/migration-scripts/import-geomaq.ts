import { MedusaContainer } from "@medusajs/framework"
import * as fs from "fs"
import * as path from "path"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

// Importa o catalogo Geomaq (data/geomaq_parts.csv + images/) pro Medusa:
// 1 categoria por linha (Algodao/Amendoim/Construcao/Verde), 1 produto por
// peca (preco 0,00 — catalogo de papel nao tem preco), imagem sobe pro R2
// via file module ja configurado, metadata guarda o fabricante real (Geomaq)
// e os campos originais da extracao.

const REPO_ROOT = path.resolve(__dirname, "../../../../..")
const CSV_PATH = path.join(REPO_ROOT, "data", "geomaq_parts.csv")
const IMAGES_ROOT = REPO_ROOT

type Row = Record<string, string>

function parseCsv(content: string): Row[] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const c = content[i]
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && content[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }

  const header = rows[0]
  return rows.slice(1).map((r) => {
    const obj: Row = {}
    header.forEach((h, idx) => (obj[h] = r[idx] ?? ""))
    return obj
  })
}

const LINE_SLUGS: Record<string, string> = {
  Algodão: "algodao",
  Amendoim: "amendoim",
  Construção: "construcao",
  Verde: "verde",
}

export default async function import_geomaq({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fileModuleService = container.resolve(Modules.FILE)

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8")
  let rows = parseCsv(csvContent).filter((r) => r.codigo)
  const limit = process.env.IMPORT_LIMIT
    ? parseInt(process.env.IMPORT_LIMIT, 10)
    : undefined
  if (limit) rows = rows.slice(0, limit)
  logger.info(`Lidas ${rows.length} pecas do CSV.`)

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfileId = shippingProfiles[0].id

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const agricolaChannel = salesChannels.find((sc: any) => sc.name === "Agricola")
  if (!agricolaChannel) {
    throw new Error(
      `Sales channel "Agricola" nao encontrado. Existentes: ${salesChannels
        .map((s: any) => s.name)
        .join(", ")}`
    )
  }
  const salesChannelId = agricolaChannel.id

  // categorias por linha
  const linhas = Array.from(new Set(rows.map((r) => r.linha).filter(Boolean)))
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
  })
  const categoryByLinha: Record<string, string> = {}
  const toCreate = linhas.filter(
    (l) => !existingCategories.find((c) => c.name === l)
  )
  if (toCreate.length) {
    const { result: created } = await createProductCategoriesWorkflow(
      container
    ).run({
      input: {
        product_categories: toCreate.map((l) => ({
          name: l,
          is_active: true,
        })),
      },
    })
    created.forEach((c) => (categoryByLinha[c.name] = c.id))
  }
  existingCategories.forEach((c) => {
    if (linhas.includes(c.name)) categoryByLinha[c.name] = c.id
  })

  logger.info(`Categorias prontas: ${Object.keys(categoryByLinha).join(", ")}`)

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "metadata"],
  })
  const existingSkus = new Set(
    existingProducts.map((p: any) => p.metadata?.geomaq_codigo).filter(Boolean)
  )

  let created = 0
  let skipped = 0
  let failed = 0

  const pending = rows.filter((r) => !existingSkus.has(r.codigo.trim()))
  logger.info(
    `${pending.length} pecas a importar (${rows.length - pending.length} ja existiam).`
  )
  skipped = rows.length - pending.length

  async function processRow(row: Row) {
    const codigo = row.codigo.trim()
    const nome = row.nome?.trim() || codigo
    const title = `${nome} — ${codigo}`
    const linha = row.linha
    const categoryId = categoryByLinha[linha]

    let imageUrl: string | undefined
    const imagemRel = row.imagem?.trim()
    if (imagemRel) {
      const imagePath = path.join(IMAGES_ROOT, imagemRel)
      try {
        const buf = fs.readFileSync(imagePath)
        const uploaded = await fileModuleService.createFiles({
          filename: path.basename(imagemRel),
          mimeType: "image/png",
          content: buf.toString("base64"),
          access: "public",
        })
        imageUrl = (uploaded as any).url
      } catch (e) {
        logger.warn(`Falha ao subir imagem de ${codigo}: ${(e as Error).message}`)
      }
    }

    try {
      await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title,
              handle: codigo
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, ""),
              description:
                [row.aplicacao, row.specs].filter(Boolean).join(" — ") ||
                undefined,
              status: ProductStatus.PUBLISHED,
              category_ids: categoryId ? [categoryId] : [],
              shipping_profile_id: shippingProfileId,
              sales_channels: [{ id: salesChannelId }],
              images: imageUrl ? [{ url: imageUrl }] : [],
              thumbnail: imageUrl,
              options: [{ title: "Padrão", values: ["Padrão"] }],
              variants: [
                {
                  title: nome,
                  sku: codigo,
                  options: { Padrão: "Padrão" },
                  prices: [{ amount: 0, currency_code: "brl" }],
                },
              ],
              metadata: {
                geomaq_codigo: codigo,
                familia: row.familia || undefined,
                aplicacao: row.aplicacao || undefined,
                specs: row.specs || undefined,
                revisar: row.revisar === "sim",
                revisar_motivo: row.revisar_motivo || undefined,
                fonte_pagina: row.pagina || undefined,
                fonte_arquivo: row.arquivo || undefined,
              },
            },
          ],
        },
      })
      created++
      if (created % 20 === 0) {
        logger.info(`... ${created}/${pending.length} produtos criados ate agora`)
      }
    } catch (e) {
      failed++
      logger.error(`Falha ao criar produto ${codigo}: ${(e as Error).message}`)
    }
  }

  const CONCURRENCY = 8
  let cursor = 0
  async function worker() {
    while (cursor < pending.length) {
      const row = pending[cursor++]
      await processRow(row)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker)
  )

  logger.info(
    `Importacao concluida: ${created} criados, ${skipped} ja existiam, ${failed} falharam.`
  )
}
