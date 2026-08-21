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
import { Category, Compatibility, Filter } from "@modules/common/icons/parts"

type RefinementListProps = {
  sortBy: SortOptions
  categories?: HttpTypes.StoreProductCategory[]
  query?: string
  application?: CatalogApplication
  /** máquinas compatíveis com contagem, da camada de leitura */
  aplicacoes?: Array<{ nome: string; total: number }>
  aplicacaoAtiva?: string
  search?: boolean
  "data-testid"?: string
}

const RefinementList = ({
  sortBy,
  categories = [],
  query,
  application,
  aplicacoes = [],
  aplicacaoAtiva,
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
              className="text-xs font-medium text-[#0B6B3F] hover:underline"
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
              className="text-xs font-medium text-[#0B6B3F] hover:underline"
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
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ui-fg-base">
            <Category aria-hidden="true" className="h-4 w-4 text-ui-fg-muted" />
            Departamentos
          </h2>
          <nav aria-label="Departamentos do catálogo">
            <ul className="space-y-1">
              {categories.map((category) => (
                <li key={category.id}>
                  <LocalizedClientLink
                    href={`/categories/${category.handle}`}
                    className="group flex items-center justify-between gap-3 rounded-rounded px-2 py-2 text-sm text-ui-fg-subtle transition-colors hover:bg-ui-bg-subtle hover:text-[#0B6B3F]"
                  >
                    <span>{category.name}</span>
                    <span
                      className="text-xs text-ui-fg-muted group-hover:text-[#0B6B3F]"
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
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ui-fg-base">
            <Compatibility aria-hidden="true" className="h-4 w-4 text-ui-fg-muted" />
            Compatibilidade
          </h2>
          <p className="mb-3 text-xs leading-5 text-ui-fg-subtle">
            Encontre peças pela marca da máquina.
          </p>
          <div className="flex flex-wrap gap-2">
            {(aplicacoes.length
              ? aplicacoes
              : CATALOG_APPLICATIONS.map((o) => ({ nome: o.name, total: 0 }))
            ).map((option) => {
              const active = aplicacaoAtiva === option.nome
              // As 8 marcas com página própria (/aplicacoes/<marca>) linkam
              // pra ela — é a URL indexada; as demais filtram o catálogo.
              const pagina = CATALOG_APPLICATIONS.find((o) => o.name === option.nome)
              const href = pagina
                ? `/aplicacoes/${pagina.handle}`
                : `/store?aplicacao=${encodeURIComponent(option.nome)}`

              return (
                <LocalizedClientLink
                  key={option.nome}
                  href={active ? "/store" : href}
                  aria-current={active ? "page" : undefined}
                  title={option.total ? `${option.total.toLocaleString("pt-BR")} peças` : undefined}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-[#0B6B3F] bg-[#0B6B3F] text-white"
                      : "border-ui-border-base bg-white text-ui-fg-subtle hover:border-[#0B6B3F] hover:text-[#0B6B3F]"
                  }`}
                >
                  {option.nome}
                  {option.total ? (
                    <span className="ml-1 text-[10px] opacity-70">
                      {option.total.toLocaleString("pt-BR")}
                    </span>
                  ) : null}
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
          <span className="flex items-center gap-2">
            <Filter aria-hidden="true" className="h-4 w-4" />
            Filtrar e ordenar
          </span>
          <span aria-hidden="true">＋</span>
        </summary>
        <div className="mt-5 border-t border-ui-border-base pt-5">{panel}</div>
      </details>
      <div className="hidden rounded-large border border-ui-border-base bg-white p-5 shadow-sm small:block">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-lg font-semibold">Filtrar catálogo</p>
          <span className="rounded-full bg-[#edf8f1] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#0B6B3F]">
            Técnico
          </span>
        </div>
        {panel}
      </div>
    </aside>
  )
}

export default RefinementList
