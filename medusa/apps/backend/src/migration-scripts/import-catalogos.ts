import type { MedusaContainer } from "@medusajs/framework"
import * as fs from "fs"
import * as path from "path"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

const catalogDataCandidates = [
  process.env.CATALOG_DATA_ROOT,
  path.resolve(process.cwd(), "data", "processed"),
  path.resolve(process.cwd(), "..", "..", "..", "data", "processed"),
].filter((candidate): candidate is string => Boolean(candidate))
const CATALOG_DATA_ROOT =
  catalogDataCandidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "catalog_audit.json"))
  ) || catalogDataCandidates[0]
const CATALOG_PATH = path.join(CATALOG_DATA_ROOT, "catalog_import.csv")
const AUDIT_PATH = path.join(CATALOG_DATA_ROOT, "catalog_audit.json")

type CsvRow = Record<string, string>

type CatalogItem = {
  importKey: string
  source: string
  sourceCode: string
  sourceSku: string
  title: string
  description?: string
  category: string
  imageUrl?: string
  weight?: number
  metadata: Record<string, unknown>
}

function invalidCatalog(message: string): MedusaError {
  return new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < content.length; index++) {
    const character = content[index]
    if (inQuotes) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          field += '"'
          index++
        } else {
          inQuotes = false
        }
      } else {
        field += character
      }
    } else if (character === '"') {
      inQuotes = true
    } else if (character === ",") {
      row.push(field)
      field = ""
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && content[index + 1] === "\n") {
        index++
      }
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") {
        rows.push(row)
      }
      row = []
    } else {
      field += character
    }
  }

  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }

  const header = rows[0]
  return rows.slice(1).map((values) => {
    const parsed: CsvRow = {}
    header.forEach((name, index) => {
      parsed[name] = values[index] ?? ""
    })
    return parsed
  })
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function readCatalog(): CatalogItem[] {
  if (!fs.existsSync(CATALOG_PATH) || !fs.existsSync(AUDIT_PATH)) {
    throw invalidCatalog(
      "Catalogo tratado ausente. Execute python scripts/process_catalogs.py."
    )
  }

  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf-8"))
  if (
    audit.checks_passed !== true ||
    audit.deployment_ready !== true ||
    audit.unclassified !== 0 ||
    audit.total_import < 1
  ) {
    throw invalidCatalog(
      "Auditoria do catalogo reprovada. Importacao bloqueada."
    )
  }
  if (
    audit.deployment_ready !== true &&
    process.env.ALLOW_INCOMPLETE_SOURCE !== "true"
  ) {
    throw invalidCatalog(
      "Fonte incompleta. Finalize a coleta ou defina " +
        "ALLOW_INCOMPLETE_SOURCE=true conscientemente."
    )
  }

  const rows = parseCsv(fs.readFileSync(CATALOG_PATH, "utf-8"))
  if (rows.length !== audit.total_import) {
    throw invalidCatalog(
      `Contagem divergente: CSV=${rows.length}, auditoria=${audit.total_import}.`
    )
  }

  const seenImportKeys = new Set<string>()
  const items = rows.map((row, index) => {
    const required = ["import_key", "source", "source_code", "title", "category"]
    const missing = required.filter((field) => !row[field])
    if (missing.length) {
      throw invalidCatalog(
        `Linha ${index + 2} invalida. Campos ausentes: ${missing.join(", ")}`
      )
    }
    if (seenImportKeys.has(row.import_key)) {
      throw invalidCatalog(`import_key duplicada: ${row.import_key}`)
    }
    seenImportKeys.add(row.import_key)

    const metadata = JSON.parse(row.metadata_json)
    if (metadata.import_key !== row.import_key) {
      throw invalidCatalog(`Metadata divergente na linha ${index + 2}.`)
    }

    return {
      importKey: row.import_key,
      source: row.source,
      sourceCode: row.source_code,
      sourceSku: row.source_sku,
      title: row.title,
      description: row.description || undefined,
      category: row.category,
      imageUrl: row.image_url || undefined,
      weight: row.weight_grams ? Number(row.weight_grams) : undefined,
      metadata,
    }
  })

  return items
}

async function readExistingImportKeys(
  container: MedusaContainer
): Promise<Set<string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const importKeys = new Set<string>()
  const take = 1000
  let skip = 0

  while (true) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "metadata"],
      pagination: { skip, take },
    })
    products.forEach((product: any) => {
      const importKey = product.metadata?.import_key
      if (typeof importKey === "string" && importKey) {
        importKeys.add(importKey)
      }
    })
    if (products.length < take) {
      break
    }
    skip += products.length
  }

  return importKeys
}

export default async function importCatalogos({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fileModuleService = container.resolve(Modules.FILE)
  const selectedSources = process.env.IMPORT_SOURCES
    ? new Set(
        process.env.IMPORT_SOURCES.split(",")
          .map((source) => source.trim())
          .filter(Boolean)
      )
    : null

  let items = readCatalog()
  if (selectedSources) {
    items = items.filter((item) => selectedSources.has(item.source))
  }

  const limit = process.env.IMPORT_LIMIT
    ? Number.parseInt(process.env.IMPORT_LIMIT, 10)
    : undefined
  if (limit && limit > 0) {
    items = items.slice(0, limit)
  }

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  if (!shippingProfiles.length) {
    throw invalidCatalog("Nenhum perfil de entrega encontrado.")
  }

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const salesChannel = salesChannels.find(
    (channel: any) => channel.name === "Agricola"
  )
  if (!salesChannel) {
    throw invalidCatalog('Canal de vendas "Agricola" nao encontrado.')
  }
  const salesChannelId = salesChannel.id

  const categoryNames = Array.from(new Set(items.map((item) => item.category)))
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
    pagination: { take: 1000 },
  })
  const categoryByName = new Map<string, string>(
    existingCategories.map((category: any) => [category.name, category.id])
  )
  const categoriesToCreate = categoryNames.filter(
    (name) => !categoryByName.has(name)
  )

  if (process.env.IMPORT_DRY_RUN === "true") {
    const existingImportKeys = await readExistingImportKeys(container)
    const pending = items.filter(
      (item) => !existingImportKeys.has(item.importKey)
    )
    logger.info(
      [
        "Simulacao concluida.",
        `Selecionados: ${items.length}.`,
        `Ja existentes: ${items.length - pending.length}.`,
        `Pendentes: ${pending.length}.`,
        `Novas categorias: ${categoriesToCreate.length}.`,
      ].join(" ")
    )
    return
  }

  if (categoriesToCreate.length) {
    const { result: createdCategories } =
      await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: categoriesToCreate.map((name) => ({
            name,
            is_active: true,
          })),
        },
      })
    createdCategories.forEach((category) => {
      categoryByName.set(category.name, category.id)
    })
  }

  const existingImportKeys = await readExistingImportKeys(container)
  const pending = items.filter(
    (item) => !existingImportKeys.has(item.importKey)
  )
  const concurrency = process.env.IMPORT_CONCURRENCY
    ? Number.parseInt(process.env.IMPORT_CONCURRENCY, 10)
    : 4
  let cursor = 0
  let created = 0
  let failed = 0

  async function processItem(item: CatalogItem) {
    let imageUrl: string | undefined
    if (item.imageUrl) {
      try {
        const response = await fetch(item.imageUrl)
        if (response.ok) {
          const content = Buffer.from(await response.arrayBuffer())
          const contentType =
            response.headers.get("content-type") || "image/jpeg"
          const extension =
            contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg"
          const uploaded = await fileModuleService.createFiles({
            filename: `${slugify(item.importKey)}.${extension}`,
            mimeType: contentType,
            content: content.toString("base64"),
            access: "public",
          })
          imageUrl = (uploaded as any).url
        } else {
          logger.warn(
            `Imagem HTTP ${response.status} ignorada: ${item.importKey}`
          )
        }
      } catch (error) {
        logger.warn(
          `Imagem ignorada para ${item.importKey}: ${(error as Error).message}`
        )
      }
    }

    const createProduct = async (sku: string) =>
      await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: item.title,
              handle: slugify(item.importKey),
              description: item.description,
              status: ProductStatus.PUBLISHED,
              category_ids: [categoryByName.get(item.category)!],
              shipping_profile_id: shippingProfiles[0].id,
              sales_channels: [{ id: salesChannelId }],
              images: imageUrl ? [{ url: imageUrl }] : [],
              thumbnail: imageUrl,
              options: [{ title: "Padrão", values: ["Padrão"] }],
              variants: [
                {
                  title: "Padrão",
                  sku,
                  weight: item.weight,
                  options: { Padrão: "Padrão" },
                  prices: [{ amount: 0, currency_code: "brl" }],
                },
              ],
              metadata: item.metadata,
            },
          ],
        },
      })

    const sourceSku = item.sourceSku || slugify(item.importKey)

    try {
      await createProduct(sourceSku)
      created++
      if (created % 100 === 0) {
        logger.info(`Progresso: ${created}/${pending.length}`)
      }
    } catch (error) {
      const message = (error as Error).message
      if (message.includes(`Product variant with sku: ${sourceSku}, already exists.`)) {
        const uniqueSku = `${sourceSku}-${item.importKey.slice(-8)}`
        try {
          await createProduct(uniqueSku)
          created++
          logger.warn(
            `SKU ${sourceSku} ja existente; ${uniqueSku} aplicado a ${item.importKey}.`
          )
          return
        } catch (retryError) {
          failed++
          logger.error(
            `Falha ao criar ${item.importKey}: ${(retryError as Error).message}`
          )
          return
        }
      }
      failed++
      logger.error(
        `Falha ao criar ${item.importKey}: ${message}`
      )
    }
  }

  async function worker() {
    while (cursor < pending.length) {
      const item = pending[cursor++]
      await processItem(item)
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(concurrency, 1), pending.length) },
      worker
    )
  )

  logger.info(
    `Importacao concluida: ${created} criados, ${
      items.length - pending.length
    } existentes, ${failed} falharam.`
  )
  if (failed > 0) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Importacao terminou com ${failed} falhas.`
    )
  }
}
