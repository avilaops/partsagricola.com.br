import type { MedusaContainer } from "@medusajs/framework"
import * as fs from "fs"
import * as path from "path"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  deleteProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

type CategoryRecord = {
  id: string
  name: string
  handle: string
  description?: string | null
  parent_category_id?: string | null
  is_active?: boolean
  is_internal?: boolean
  rank?: number
}

type ProductRecord = {
  id: string
  handle: string
  categories?: { id: string }[]
}

type CategoryDefinition = {
  sourceName: string
  name: string
  handle: string
  parentHandle: string
  description: string
  rank: number
}

const departments = [
  {
    name: "Peças Agrícolas",
    handle: "pecas-agricolas",
    description:
      "Peças para plantio, colheita, tratores e implementos agrícolas.",
    rank: 0,
  },
  {
    name: "Máquinas Pesadas",
    handle: "maquinas-pesadas",
    description:
      "Componentes para construção, terraplenagem e material rodante.",
    rank: 1,
  },
  {
    name: "Vedações e Selagem",
    handle: "vedacoes-e-selagem",
    description:
      "O-rings, retentores, gaxetas, raspadores e vedações industriais.",
    rank: 2,
  },
  {
    name: "Kits e Reparos",
    handle: "kits-e-reparos",
    description: "Kits técnicos para manutenção e recuperação de conjuntos.",
    rank: 3,
  },
]

const groups = [
  {
    name: "O-Rings",
    handle: "o-rings",
    parentHandle: "vedacoes-e-selagem",
    description: "O-rings por padrão dimensional e aplicação.",
    rank: 0,
  },
  {
    name: "Vedações Industriais",
    handle: "vedacoes-industriais",
    parentHandle: "vedacoes-e-selagem",
    description: "Vedações organizadas por fabricante e aplicação industrial.",
    rank: 4,
  },
]

const categories: CategoryDefinition[] = [
  {
    sourceName: "Peças Agrícolas - Grãos",
    name: "Grãos",
    handle: "graos",
    parentHandle: "pecas-agricolas",
    description: "Peças para colheitadeiras e plataformas de grãos.",
    rank: 0,
  },
  {
    sourceName: "Peças Agrícolas - Canavieira",
    name: "Cana-de-açúcar",
    handle: "cana-de-acucar",
    parentHandle: "pecas-agricolas",
    description: "Peças para colhedoras e equipamentos da linha canavieira.",
    rank: 1,
  },
  {
    sourceName: "Peças Agrícolas - Tratores",
    name: "Tratores",
    handle: "tratores",
    parentHandle: "pecas-agricolas",
    description: "Componentes para tratores de diferentes marcas e modelos.",
    rank: 2,
  },
  {
    sourceName: "Peças Agrícolas - Amendoim",
    name: "Amendoim",
    handle: "amendoim",
    parentHandle: "pecas-agricolas",
    description: "Peças para máquinas de colheita e beneficiamento de amendoim.",
    rank: 3,
  },
  {
    sourceName: "Peças Agrícolas - Implementos Agrícolas",
    name: "Implementos Agrícolas",
    handle: "implementos-agricolas",
    parentHandle: "pecas-agricolas",
    description: "Peças para implementos, plantadeiras e equipamentos agrícolas.",
    rank: 4,
  },
  {
    sourceName: "Peças Agrícolas - Algodão",
    name: "Algodão",
    handle: "algodao",
    parentHandle: "pecas-agricolas",
    description: "Peças para colheitadeiras e plataformas de algodão.",
    rank: 5,
  },
  {
    sourceName: "Verde",
    name: "Linha Verde",
    handle: "linha-verde",
    parentHandle: "pecas-agricolas",
    description: "Seleção de componentes para a linha agrícola verde.",
    rank: 6,
  },
  {
    sourceName: "Máquinas Pesadas - Construção",
    name: "Construção",
    handle: "construcao",
    parentHandle: "maquinas-pesadas",
    description: "Peças para escavadeiras, carregadeiras e máquinas de construção.",
    rank: 0,
  },
  {
    sourceName: "Máquinas Pesadas - Rodante",
    name: "Material Rodante",
    handle: "material-rodante",
    parentHandle: "maquinas-pesadas",
    description: "Componentes de esteiras e material rodante para máquinas pesadas.",
    rank: 1,
  },
  {
    sourceName: "O-Rings - Milimétricos",
    name: "Milimétricos",
    handle: "o-rings-milimetricos",
    parentHandle: "o-rings",
    description: "O-rings com medidas no padrão métrico.",
    rank: 0,
  },
  {
    sourceName: "O-Rings - Standard",
    name: "Standard",
    handle: "o-rings-standard",
    parentHandle: "o-rings",
    description: "O-rings em padrões dimensionais standard.",
    rank: 1,
  },
  {
    sourceName: "Gaxetas e Raspadores",
    name: "Gaxetas e Raspadores",
    handle: "gaxetas-e-raspadores",
    parentHandle: "vedacoes-e-selagem",
    description: "Gaxetas e raspadores para sistemas hidráulicos e pneumáticos.",
    rank: 1,
  },
  {
    sourceName: "Reparos Pneumáticos",
    name: "Reparos Pneumáticos",
    handle: "reparos-pneumaticos",
    parentHandle: "vedacoes-e-selagem",
    description: "Componentes de reparo para cilindros e sistemas pneumáticos.",
    rank: 2,
  },
  {
    sourceName: "Retentores",
    name: "Retentores",
    handle: "retentores",
    parentHandle: "vedacoes-e-selagem",
    description: "Retentores por medida, material e aplicação.",
    rank: 3,
  },
  {
    sourceName: "Kits de Reparo - Direção Hidráulica",
    name: "Direção Hidráulica",
    handle: "direcao-hidraulica",
    parentHandle: "kits-e-reparos",
    description: "Kits de reparo para caixas e sistemas de direção hidráulica.",
    rank: 0,
  },
]

const industrialBrands = [
  "Caterpillar",
  "Fiat",
  "Case",
  "Massey Ferguson",
  "Fiat Anéis",
  "Michigan",
  "Komatsu",
  "Michigan Anéis",
  "Volvo",
  "Huber Warco",
  "New Holland Industrial",
  "Yale Carregadeira",
  "Danfoss",
  "Hyundai",
  "JCB",
  "Randon",
  "Muller",
  "Bob Cat",
  "POCLAIN",
  "Dinapac",
  "Engesa",
]

industrialBrands.forEach((brand, rank) => {
  categories.push({
    sourceName: `Vedações Industriais - ${brand}`,
    name: brand,
    handle: `vedacoes-industriais-${slugify(brand)}`,
    parentHandle: "vedacoes-industriais",
    description: `Vedações industriais para aplicações ${brand}.`,
    rank,
  })
})

const duplicateMerges = [
  { legacyName: "Algodão", targetSourceName: "Peças Agrícolas - Algodão" },
  { legacyName: "Amendoim", targetSourceName: "Peças Agrícolas - Amendoim" },
  {
    legacyName: "Construção",
    targetSourceName: "Máquinas Pesadas - Construção",
  },
]

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function invalidTaxonomy(message: string): MedusaError {
  return new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

async function readAll<T>(
  query: any,
  entity: string,
  fields: string[]
): Promise<T[]> {
  const records: T[] = []
  const take = 1000
  let skip = 0

  while (true) {
    const { data } = await query.graph({
      entity,
      fields,
      pagination: { skip, take },
    })
    records.push(...data)
    if (data.length < take) {
      return records
    }
    skip += data.length
  }
}

async function readCatalogState(query: any) {
  const [allCategories, products] = await Promise.all([
    readAll<CategoryRecord>(query, "product_category", [
      "id",
      "name",
      "handle",
      "description",
      "parent_category_id",
      "is_active",
      "is_internal",
      "rank",
    ]),
    readAll<ProductRecord>(query, "product", [
      "id",
      "handle",
      "categories.id",
    ]),
  ])

  return { categories: allCategories, products }
}

function findCategory(
  allCategories: CategoryRecord[],
  sourceName: string,
  finalHandle: string
) {
  return (
    allCategories.find((category) => category.name === sourceName) ||
    allCategories.find((category) => category.handle === finalHandle)
  )
}

function productsByCategory(products: ProductRecord[]) {
  const result = new Map<string, ProductRecord[]>()
  products.forEach((product) => {
    product.categories?.forEach((category) => {
      const current = result.get(category.id) || []
      current.push(product)
      result.set(category.id, current)
    })
  })
  return result
}

function categorySummary(state: Awaited<ReturnType<typeof readCatalogState>>) {
  const linkedProducts = state.products.filter(
    (product) => product.categories?.length
  ).length
  const links = state.products.reduce(
    (total, product) => total + (product.categories?.length || 0),
    0
  )

  return {
    products: state.products.length,
    categories: state.categories.length,
    linkedProducts,
    links,
    uncategorized: state.products.length - linkedProducts,
    multipleCategories: state.products.filter(
      (product) => (product.categories?.length || 0) > 1
    ).length,
  }
}

function writeSnapshot(
  state: Awaited<ReturnType<typeof readCatalogState>>,
  logger: any
) {
  const configuredPath = process.env.TAXONOMY_SNAPSHOT_PATH
  const snapshotPath = configuredPath
    ? path.resolve(configuredPath)
    : path.resolve(
        process.cwd(),
        "data",
        `taxonomy-snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
      )

  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        summary: categorySummary(state),
        categories: state.categories,
        products: state.products,
      },
      null,
      2
    )
  )
  logger.info(`Snapshot salvo em ${snapshotPath}`)
}

async function createStructuralCategories(
  container: MedusaContainer,
  currentCategories: CategoryRecord[]
) {
  const missingDepartments = departments.filter(
    (definition) =>
      !currentCategories.some(
        (category) => category.handle === definition.handle
      )
  )

  if (missingDepartments.length) {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingDepartments.map((definition) => ({
          ...definition,
          is_active: true,
          is_internal: false,
        })),
      },
    })
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const refreshed = await readAll<CategoryRecord>(query, "product_category", [
    "id",
    "name",
    "handle",
    "description",
    "parent_category_id",
    "is_active",
    "is_internal",
    "rank",
  ])
  const missingGroups = groups.filter(
    (definition) =>
      !refreshed.some((category) => category.handle === definition.handle)
  )

  if (missingGroups.length) {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingGroups.map((definition) => {
          const parent = refreshed.find(
            (category) => category.handle === definition.parentHandle
          )
          if (!parent) {
            throw invalidTaxonomy(
              `Departamento ausente: ${definition.parentHandle}`
            )
          }
          return {
            name: definition.name,
            handle: definition.handle,
            description: definition.description,
            rank: definition.rank,
            parent_category_id: parent.id,
            is_active: true,
            is_internal: false,
          }
        }),
      },
    })
  }
}

async function mergeLegacyCategories(
  container: MedusaContainer,
  state: Awaited<ReturnType<typeof readCatalogState>>,
  logger: any
) {
  const byCategory = productsByCategory(state.products)

  for (const merge of duplicateMerges) {
    const definition = categories.find(
      (category) => category.sourceName === merge.targetSourceName
    )!
    const target = findCategory(
      state.categories,
      merge.targetSourceName,
      definition.handle
    )
    const legacy = state.categories.find(
      (category) =>
        category.name === merge.legacyName && category.id !== target?.id
    )

    if (!target) {
      throw invalidTaxonomy(
        `Categoria de destino ausente: ${merge.targetSourceName}`
      )
    }
    if (!legacy) {
      continue
    }

    const products = byCategory.get(legacy.id) || []
    for (let index = 0; index < products.length; index += 100) {
      await updateProductsWorkflow(container).run({
        input: {
          products: products.slice(index, index + 100).map((product) => ({
            id: product.id,
            category_ids: [target.id],
          })),
        },
      })
    }

    await deleteProductCategoriesWorkflow(container).run({
      input: [legacy.id],
    })
    logger.info(
      `${products.length} produtos movidos de ${legacy.name} para ${target.name}`
    )
  }
}

async function updateCategory(
  container: MedusaContainer,
  category: CategoryRecord,
  update: Record<string, unknown>
) {
  const changed = Object.entries(update).some(
    ([key, value]) => category[key as keyof CategoryRecord] !== value
  )
  if (!changed) {
    return
  }

  await updateProductCategoriesWorkflow(container).run({
    input: {
      selector: { id: category.id },
      update,
    },
  })
}

function countDepartmentProducts(
  department: CategoryRecord,
  allCategories: CategoryRecord[],
  byCategory: Map<string, ProductRecord[]>
) {
  const descendants = new Set([department.id])
  let foundNew = true
  while (foundNew) {
    foundNew = false
    allCategories.forEach((category) => {
      if (
        category.parent_category_id &&
        descendants.has(category.parent_category_id) &&
        !descendants.has(category.id)
      ) {
        descendants.add(category.id)
        foundNew = true
      }
    })
  }

  return Array.from(descendants).reduce(
    (total, categoryId) => total + (byCategory.get(categoryId)?.length || 0),
    0
  )
}

function validateFinalState(
  before: Awaited<ReturnType<typeof readCatalogState>>,
  after: Awaited<ReturnType<typeof readCatalogState>>
) {
  const beforeSummary = categorySummary(before)
  const afterSummary = categorySummary(after)
  if (afterSummary.products !== beforeSummary.products) {
    throw invalidTaxonomy(
      `Total de produtos alterado: ${beforeSummary.products} -> ${afterSummary.products}`
    )
  }
  if (afterSummary.uncategorized !== 0 || afterSummary.multipleCategories !== 0) {
    throw invalidTaxonomy(
      `Vínculos inválidos: sem categoria=${afterSummary.uncategorized}, múltiplas=${afterSummary.multipleCategories}`
    )
  }
  if (afterSummary.links !== afterSummary.products) {
    throw invalidTaxonomy(
      `Quantidade de vínculos (${afterSummary.links}) difere dos produtos (${afterSummary.products})`
    )
  }

  const roots = after.categories.filter(
    (category) => !category.parent_category_id
  )
  const unexpectedRoots = roots.filter(
    (category) =>
      !departments.some((department) => department.handle === category.handle)
  )
  if (roots.length !== departments.length || unexpectedRoots.length) {
    throw invalidTaxonomy(
      `Raízes inválidas: ${roots.map((category) => category.handle).join(", ")}`
    )
  }

  const missingHandles = [...departments, ...groups, ...categories].filter(
    (definition) =>
      !after.categories.some((category) => category.handle === definition.handle)
  )
  if (missingHandles.length) {
    throw invalidTaxonomy(
      `Categorias ausentes: ${missingHandles
        .map((category) => category.handle)
        .join(", ")}`
    )
  }
}

export default async function restructureCatalogTaxonomy({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const dryRun = process.env.TAXONOMY_DRY_RUN !== "false"
  const before = await readCatalogState(query)
  const beforeSummary = categorySummary(before)

  logger.info(`Estado atual: ${JSON.stringify(beforeSummary)}`)
  logger.info(
    `Plano: 4 departamentos, 2 grupos, ${categories.length} categorias finais e 3 fusões controladas`
  )

  const unresolved = categories.filter(
    (definition) =>
      !findCategory(before.categories, definition.sourceName, definition.handle)
  )
  if (unresolved.length) {
    throw invalidTaxonomy(
      `Categorias de origem ausentes: ${unresolved
        .map((category) => category.sourceName)
        .join(", ")}`
    )
  }

  if (dryRun) {
    logger.info("Simulação concluída sem alterações. Use TAXONOMY_DRY_RUN=false.")
    return
  }

  writeSnapshot(before, logger)
  await createStructuralCategories(container, before.categories)

  let current = await readCatalogState(query)
  await mergeLegacyCategories(container, current, logger)
  current = await readCatalogState(query)

  for (const department of departments) {
    const existing = current.categories.find(
      (category) => category.handle === department.handle
    )!
    await updateCategory(container, existing, {
      name: department.name,
      description: department.description,
      rank: department.rank,
      parent_category_id: null,
      is_active: true,
      is_internal: false,
    })
  }

  current = await readCatalogState(query)
  for (const group of groups) {
    const existing = current.categories.find(
      (category) => category.handle === group.handle
    )!
    const parent = current.categories.find(
      (category) => category.handle === group.parentHandle
    )!
    await updateCategory(container, existing, {
      name: group.name,
      description: group.description,
      rank: group.rank,
      parent_category_id: parent.id,
      is_active: true,
      is_internal: false,
    })
  }

  current = await readCatalogState(query)
  for (const definition of categories) {
    const existing = findCategory(
      current.categories,
      definition.sourceName,
      definition.handle
    )
    const parent = current.categories.find(
      (category) => category.handle === definition.parentHandle
    )
    if (!existing || !parent) {
      throw invalidTaxonomy(
        `Não foi possível atualizar ${definition.sourceName}`
      )
    }
    await updateCategory(container, existing, {
      name: definition.name,
      handle: definition.handle,
      description: definition.description,
      rank: definition.rank,
      parent_category_id: parent.id,
      is_active: true,
      is_internal: false,
    })
  }

  const after = await readCatalogState(query)
  validateFinalState(before, after)
  const byCategory = productsByCategory(after.products)
  const departmentCounts = Object.fromEntries(
    departments.map((definition) => {
      const department = after.categories.find(
        (category) => category.handle === definition.handle
      )!
      return [
        definition.handle,
        countDepartmentProducts(department, after.categories, byCategory),
      ]
    })
  )

  logger.info(`Estado final: ${JSON.stringify(categorySummary(after))}`)
  logger.info(`Produtos por departamento: ${JSON.stringify(departmentCounts)}`)
  logger.info("Taxonomia reestruturada e validada com sucesso.")
}
