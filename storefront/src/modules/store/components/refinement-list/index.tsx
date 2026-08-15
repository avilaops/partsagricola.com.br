"use client"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import {
  CATALOG_APPLICATIONS,
  CatalogApplication,
} from "@lib/data/catalog-applications"

import SortProducts, { SortOptions } from "./sort-products"

type RefinementListProps = {
  sortBy: SortOptions
  categories?: HttpTypes.StoreProductCategory[]
  query?: string
  application?: CatalogApplication
  search?: boolean
  "data-testid"?: string
}

const RefinementList = ({
  sortBy,
  categories = [],
  query,
  application,
  "data-testid": dataTestId,
}: RefinementListProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createQueryString = useCallback(
    (name: string, value?: string) => {
      const params = new URLSearchParams(searchParams)

      if (value) {
        params.set(name, value)
      } else {
        params.delete(name)
      }

      if (name !== "page") {
        params.delete("page")
      }

      return params.toString()
    },
    [searchParams]
  )

  const setQueryParams = (name: string, value: string) => {
    const nextQuery = createQueryString(name, value)
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }

  const clearQuery = () => {
    const nextQuery = createQueryString("q")
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }

  const panel = (
    <div className="space-y-7">
      {query && !application ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ui-fg-base">
              Filtro ativo
            </h2>
            <button
              type="button"
              onClick={clearQuery}
              className="text-xs font-medium text-[#0b6b3a] hover:underline"
            >
              Limpar
            </button>
          </div>
          <button
            type="button"
            onClick={clearQuery}
            className="flex w-full items-center justify-between gap-3 rounded-rounded border border-[#acd5bc] bg-[#edf8f1] px-3 py-2.5 text-left text-sm font-medium text-[#075b31]"
          >
            <span className="truncate">{query}</span>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}

      {application ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ui-fg-base">
              Aplicação ativa
            </h2>
            <LocalizedClientLink
              href="/store"
              className="text-xs font-medium text-[#0b6b3a] hover:underline"
            >
              Limpar
            </LocalizedClientLink>
          </div>
          <LocalizedClientLink
            href="/store"
            className="flex w-full items-center justify-between gap-3 rounded-rounded border border-[#acd5bc] bg-[#edf8f1] px-3 py-2.5 text-left text-sm font-medium text-[#075b31]"
          >
            <span className="truncate">{application.name}</span>
            <span aria-hidden="true">×</span>
          </LocalizedClientLink>
        </div>
      ) : null}

      {categories.length ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ui-fg-base">
            Departamentos
          </h2>
          <nav aria-label="Departamentos do catálogo">
            <ul className="space-y-1">
              {categories.map((category) => (
                <li key={category.id}>
                  <LocalizedClientLink
                    href={`/categories/${category.handle}`}
                    className="group flex items-center justify-between gap-3 rounded-rounded px-2 py-2 text-sm text-ui-fg-subtle transition-colors hover:bg-ui-bg-subtle hover:text-[#0b6b3a]"
                  >
                    <span>{category.name}</span>
                    <span
                      className="text-xs text-ui-fg-muted group-hover:text-[#0b6b3a]"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}

      {categories.length ? (
        <div>
          <h2 className="mb-1 text-sm font-semibold text-ui-fg-base">
            Compatibilidade
          </h2>
          <p className="mb-3 text-xs leading-5 text-ui-fg-subtle">
            Encontre peças pela marca da máquina.
          </p>
          <div className="flex flex-wrap gap-2">
            {CATALOG_APPLICATIONS.map((option) => {
              const active = application?.handle === option.handle

              return (
                <LocalizedClientLink
                  key={option.handle}
                  href={`/aplicacoes/${option.handle}`}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-[#0b6b3a] bg-[#0b6b3a] text-white"
                      : "border-ui-border-base bg-white text-ui-fg-subtle hover:border-[#0b6b3a] hover:text-[#0b6b3a]"
                  }`}
                >
                  {option.name}
                </LocalizedClientLink>
              )
            })}
          </div>
        </div>
      ) : null}

      {categories.length ? (
        <LocalizedClientLink
          href="/medidas"
          className="group block rounded-large bg-[#092f20] p-4 text-white transition hover:bg-[#0b3b28]"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8fd1a9]">
            Busca de precisão
          </span>
          <span className="mt-2 block text-sm font-semibold">
            Encontrar vedação por medidas
          </span>
          <span className="mt-2 block text-xs leading-5 text-white/70">
            O-rings, retentores e gaxetas.
          </span>
          <span className="mt-3 block text-sm font-semibold group-hover:underline">
            Abrir localizador →
          </span>
        </LocalizedClientLink>
      ) : null}

      <div className="border-t border-ui-border-base pt-6">
        <SortProducts
          sortBy={sortBy}
          setQueryParams={setQueryParams}
          data-testid={dataTestId}
        />
      </div>
    </div>
  )

  return (
    <aside className="mb-8 w-full shrink-0 small:sticky small:top-24 small:mr-10 small:w-64">
      <details className="rounded-large border border-ui-border-base bg-white p-4 shadow-sm small:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
          <span>Filtrar e ordenar</span>
          <span aria-hidden="true">＋</span>
        </summary>
        <div className="mt-5 border-t border-ui-border-base pt-5">{panel}</div>
      </details>
      <div className="hidden rounded-large border border-ui-border-base bg-white p-5 shadow-sm small:block">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-lg font-semibold">Filtrar catálogo</p>
          <span className="rounded-full bg-[#edf8f1] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#0b6b3a]">
            Técnico
          </span>
        </div>
        {panel}
      </div>
    </aside>
  )
}

export default RefinementList
