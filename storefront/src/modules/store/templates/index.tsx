import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

import PaginatedProducts from "./paginated-products"
import SearchAutocomplete from "@modules/search/components/search-autocomplete"
import { listCategories } from "@lib/data/categories"
import { CatalogApplication } from "@lib/data/catalog-applications"

const StoreTemplate = async ({
  sortBy,
  page,
  query,
  countryCode,
  application,
}: {
  sortBy?: SortOptions
  page?: string
  query?: string
  countryCode: string
  application?: CatalogApplication
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  const categories = await listCategories({ limit: 100 })
  const rootCategories = categories.filter(
    (category) => !category.parent_category && !category.parent_category_id
  )

  return (
    <div
      className="py-6 content-container small:py-10"
      data-testid="category-container"
    >
      <div className="mb-8 rounded-large bg-[#f4f8f5] px-5 py-7 small:px-8 small:py-9">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0b6b3a]">
          {application ? "Aplicação e compatibilidade" : "Catálogo técnico Ávila"}
        </p>
        <div className="flex flex-col justify-between gap-5 small:flex-row small:items-end">
          <div>
            <h1
              className="text-3xl font-semibold tracking-tight small:text-4xl"
              data-testid="store-page-title"
            >
              {application
                ? `Peças para ${application.name}`
                : query
                ? `Resultados para “${query}”`
                : "Todos os produtos"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ui-fg-subtle small:text-base">
              {application
                ? application.description
                : "Pesquise pelo código ou refine por departamento e compatibilidade para chegar à peça correta."}
            </p>
            {application ? (
              <p className="mt-3 text-xs text-ui-fg-muted">
                A marca indica compatibilidade informada no catálogo, não
                afiliação comercial.
              </p>
            ) : null}
          </div>
          <div className="w-full max-w-2xl">
            <SearchAutocomplete
              countryCode={countryCode}
              defaultValue={query}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col small:flex-row small:items-start">
        <RefinementList
          sortBy={sort}
          categories={rootCategories}
          query={query}
          application={application}
        />
        <div className="min-w-0 w-full">
        <Suspense fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            query={query}
            countryCode={countryCode}
          />
        </Suspense>
        </div>
      </div>
    </div>
  )
}

export default StoreTemplate
