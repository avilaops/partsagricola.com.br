import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { toAnalyticsItem } from "@lib/util/analytics"
import ListViewTracker from "@modules/analytics/components/list-view-tracker"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const PRODUCT_LIMIT = 12

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
  q?: string
}

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  categoryIds,
  productsIds,
  query,
  countryCode,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  categoryIds?: string[]
  productsIds?: string[]
  query?: string
  countryCode: string
}) {
  const queryParams: PaginatedProductsParams = {
    limit: 12,
  }

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  if (categoryIds?.length) {
    queryParams["category_id"] = categoryIds
  } else if (categoryId) {
    queryParams["category_id"] = [categoryId]
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  if (query) {
    queryParams["q"] = query
  }

  if (sortBy === "created_at" && !query) {
    queryParams["order"] = "-created_at"
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  let {
    response: { products, count },
  } = await listProductsWithSort({
    page,
    queryParams,
    sortBy,
    countryCode,
  })

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)
  const firstItem = count ? (page - 1) * PRODUCT_LIMIT + 1 : 0
  const lastItem = Math.min(page * PRODUCT_LIMIT, count)

  return (
    <>
      <ListViewTracker
        items={products.map((p, index) => toAnalyticsItem(p, index))}
        listName={
          query ? `busca: ${query}` : categoryId || collectionId || "catálogo"
        }
        searchTerm={query}
        searchResults={count}
        page={page}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-ui-border-base pb-4">
        <p className="text-sm text-ui-fg-subtle" aria-live="polite">
          {count.toLocaleString("pt-BR")}{" "}
          {count === 1 ? "peça encontrada" : "peças encontradas"}
        </p>
        {count > 0 ? (
          <p className="text-xs text-ui-fg-muted">
            Exibindo {firstItem.toLocaleString("pt-BR")}–
            {lastItem.toLocaleString("pt-BR")}
          </p>
        ) : null}
      </div>
      <ul
        className="grid grid-cols-2 w-full medium:grid-cols-3 large:grid-cols-4 gap-x-4 small:gap-x-6 gap-y-8"
        data-testid="products-list"
      >
        {products.map((p) => {
          return (
            <li key={p.id}>
              <ProductPreview product={p} region={region} />
            </li>
          )
        })}
      </ul>
      {!products.length && (
        <div className="rounded-large border border-ui-border-base bg-[#f7faf8] px-6 py-12 text-center">
          <p className="text-xl font-semibold text-ui-fg-base">
            Não encontramos essa referência
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ui-fg-subtle">
            Revise o código sem espaços, procure pelo nome ou envie os dados da
            máquina para a confirmação técnica.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 xsmall:flex-row">
            <LocalizedClientLink
              href="/store"
              className="inline-flex min-h-11 items-center justify-center rounded-base border border-ui-border-base bg-white px-5 text-sm font-semibold text-ui-fg-base hover:border-[#0B6B3F]"
            >
              Limpar busca
            </LocalizedClientLink>
            <LocalizedClientLink
              href={`/contato${
                query ? `?produto=${encodeURIComponent(query)}` : ""
              }`}
              className="inline-flex min-h-11 items-center justify-center rounded-base bg-[#0B6B3F] px-5 text-sm font-semibold text-white hover:bg-[#08552e]"
            >
              Pedir ajuda para localizar
            </LocalizedClientLink>
          </div>
        </div>
      )}
      {totalPages > 1 && (
        <Pagination
          data-testid="product-pagination"
          page={page}
          totalPages={totalPages}
        />
      )}
    </>
  )
}
