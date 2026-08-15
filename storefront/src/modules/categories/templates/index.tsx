import { notFound } from "next/navigation"
import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

const collectCategoryIds = (
  category: HttpTypes.StoreProductCategory
): string[] => [
  category.id,
  ...(category.category_children?.flatMap((child) =>
    collectCategoryIds(child)
  ) || []),
]

export default function CategoryTemplate({
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
  const categoryIds = collectCategoryIds(category)

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
      <div className="mb-8 border-b border-ui-border-base pb-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-ui-fg-subtle">
          <LocalizedClientLink className="hover:text-[#0b6b3a]" href="/store">
            Catálogo
          </LocalizedClientLink>
          <span>/</span>
          {parents
            .slice()
            .reverse()
            .map((parent) => (
              <span key={parent.id} className="text-ui-fg-subtle">
                <LocalizedClientLink
                  className="hover:text-[#0b6b3a]"
                  href={`/categories/${parent.handle}`}
                >
                  {parent.name}
                </LocalizedClientLink>
                <span className="mx-2">/</span>
              </span>
            ))}
          <span>{category.name}</span>
        </div>
        <div className="max-w-3xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0b6b3a]">
            Departamento técnico
          </p>
          <h1
            className="text-3xl font-semibold tracking-tight small:text-5xl"
            data-testid="category-page-title"
          >
            {category.name}
          </h1>
        </div>
        {category.description && (
          <div className="mt-4 max-w-3xl text-base text-ui-fg-subtle small:text-lg">
            <p>{category.description}</p>
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
          <ul className="grid grid-cols-1 gap-3 xsmall:grid-cols-2 small:grid-cols-3">
              {category.category_children?.map((c) => (
                <li key={c.id}>
                  <LocalizedClientLink
                    href={`/categories/${c.handle}`}
                    className="group flex min-h-32 flex-col justify-between rounded-large border border-ui-border-base bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#0b6b3a] hover:shadow-md"
                  >
                    <div>
                      <p className="text-lg font-semibold text-ui-fg-base">
                        {c.name}
                      </p>
                      {c.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-ui-fg-subtle">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <span className="mt-4 text-sm font-medium text-[#0b6b3a]">
                      Explorar peças →
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
