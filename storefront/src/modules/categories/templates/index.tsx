import { notFound } from "next/navigation"
import Image from "next/image"
import { Suspense } from "react"

import { getCategoryVisual } from "@lib/catalog/category-visuals"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { TechnicalConfirmation } from "@modules/common/icons/parts"
import { HttpTypes } from "@medusajs/types"
import { listCategoryTree } from "@lib/data/categories"

export default async function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  // A árvore vem da camada de leitura: a cópia rasa em category_children só
  // desce um nível, e um departamento precisa listar netos também.
  const categoryIds = await listCategoryTree(category.handle)
  const visual = getCategoryVisual(category)

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)

  return (
    <div
      className="flex flex-col py-8 small:py-12 content-container"
      data-testid="category-container"
    >
      <div className="mb-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-ui-fg-subtle">
          <LocalizedClientLink className="hover:text-[#0B6B3F]" href="/store">
            Catálogo
          </LocalizedClientLink>
          <span>/</span>
          {parents
            .slice()
            .reverse()
            .map((parent) => (
              <span key={parent.id} className="text-ui-fg-subtle">
                <LocalizedClientLink
                  className="hover:text-[#0B6B3F]"
                  href={`/categories/${parent.handle}`}
                >
                  {parent.name}
                </LocalizedClientLink>
                <span className="mx-2">/</span>
              </span>
            ))}
          <span>{category.name}</span>
        </div>

        {visual ? (
          <section
            className={`grid overflow-hidden rounded-[28px] ${visual.surfaceClass} medium:grid-cols-[1fr_0.92fr]`}
          >
            <div className="flex flex-col justify-center p-7 small:p-10 medium:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B6B3F]">
                {visual.eyebrow}
              </p>
              <h1
                className="mt-3 text-3xl font-semibold tracking-tight small:text-5xl"
                data-testid="category-page-title"
              >
                {category.name}
              </h1>
              {category.description && (
                <p className="mt-4 max-w-2xl text-base leading-7 text-ui-fg-subtle small:text-lg">
                  {category.description}
                </p>
              )}
              <LocalizedClientLink
                href="/confirmacao-tecnica"
                className="mt-7 inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#0B6B3F] hover:underline"
              >
                <TechnicalConfirmation aria-hidden="true" className="h-5 w-5" />
                Confirmar código e aplicação →
              </LocalizedClientLink>
            </div>
            <div className="relative min-h-[260px] medium:min-h-[400px]">
              <Image
                src={visual.image}
                alt={visual.imageAlt}
                fill
                priority
                sizes="(min-width: 1024px) 46vw, 100vw"
                className="object-cover object-right"
              />
            </div>
          </section>
        ) : (
          <div className="border-b border-ui-border-base pb-8">
            <div className="max-w-3xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0B6B3F]">
                Linha técnica
              </p>
              <h1
                className="text-3xl font-semibold tracking-tight small:text-5xl"
                data-testid="category-page-title"
              >
                {category.name}
              </h1>
            </div>
            {category.description && (
              <p className="mt-4 max-w-3xl text-base text-ui-fg-subtle small:text-lg">
                {category.description}
              </p>
            )}
          </div>
        )}
      </div>
      {category.category_children?.length ? (
        <div className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold">Escolha uma linha</h2>
            <span className="text-sm text-ui-fg-subtle">
              {category.category_children.length} opções
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-3 medium:grid-cols-4">
            {category.category_children?.map((c) => (
              <li key={c.id}>
                <LocalizedClientLink
                  href={`/categories/${c.handle}`}
                  className="group flex min-h-24 items-center justify-between gap-3 rounded-large border border-ui-border-base bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#0B6B3F] hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-ui-fg-base small:text-base">
                      {c.name}
                    </p>
                    {c.description && (
                      <p className="mt-1 hidden line-clamp-2 text-xs text-ui-fg-subtle medium:block">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 text-lg font-medium text-[#0B6B3F]"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-col small:flex-row small:items-start">
        <RefinementList sortBy={sort} data-testid="sort-by-container" />
        <div className="w-full">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Peças disponíveis</h2>
          </div>
          <Suspense
            fallback={
              <SkeletonProductGrid
                numberOfProducts={category.products?.length ?? 8}
              />
            }
          >
            <PaginatedProducts
              sortBy={sort}
              page={pageNumber}
              categoryIds={categoryIds}
              countryCode={countryCode}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
