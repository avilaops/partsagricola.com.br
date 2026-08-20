"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@medusajs/ui"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { Recent } from "@modules/common/icons/parts/complementos"

const RECENT_SEARCHES_KEY = "agricola_recent_searches_v1"
const MAX_RECENT_SEARCHES = 6

type Suggestion = {
  id: string
  title: string
  handle: string
  thumbnail?: string | null
  code: string
  category?: string | null
}

type SearchAutocompleteProps = {
  countryCode: string
  defaultValue?: string
  variant?: "hero" | "default"
}

const SearchAutocomplete = ({
  countryCode,
  defaultValue = "",
  variant = "default",
}: SearchAutocompleteProps) => {
  const [query, setQuery] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const router = useRouter()
  const listboxId = useId()
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const storedSearches = window.localStorage.getItem(RECENT_SEARCHES_KEY)

      if (storedSearches) {
        const parsedSearches = JSON.parse(storedSearches) as string[]

        if (Array.isArray(parsedSearches)) {
          setRecentSearches(parsedSearches.slice(0, MAX_RECENT_SEARCHES))
        }
      }
    } catch {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY)
    }
  }, [])

  const saveRecentSearch = (value: string) => {
    const normalizedValue = value.trim().slice(0, 80)

    if (!normalizedValue) {
      return
    }

    setRecentSearches((currentSearches) => {
      const nextSearches = [
        normalizedValue,
        ...currentSearches.filter(
          (search) => search.toLowerCase() !== normalizedValue.toLowerCase()
        ),
      ].slice(0, MAX_RECENT_SEARCHES)

      window.localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(nextSearches)
      )

      return nextSearches
    })
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    setActiveIndex(-1)
    setIsOpen(false)
    window.localStorage.removeItem(RECENT_SEARCHES_KEY)
  }

  const runCatalogSearch = (value: string) => {
    const normalizedValue = value.trim()

    if (!normalizedValue) {
      return
    }

    saveRecentSearch(normalizedValue)
    setIsOpen(false)

    // O evento `search` sai da pagina de resultados, nao daqui: e la que
    // `search_results` existe de verdade. Disparar nos dois lugares contaria a
    // mesma busca duas vezes.
    router.push(
      `/${countryCode}/store?q=${encodeURIComponent(normalizedValue)}`
    )
  }

  useEffect(() => {
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 2) {
      setSuggestions([])
      setActiveIndex(-1)
      setIsOpen(isFocused && recentSearches.length > 0)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(
            normalizedQuery
          )}&countryCode=${encodeURIComponent(countryCode)}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          throw new Error("Suggestion request failed")
        }
        const data = (await response.json()) as { suggestions: Suggestion[] }
        setSuggestions(data.suggestions)
        setActiveIndex(-1)
        setIsOpen(isFocused)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, 280)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [countryCode, isFocused, query, recentSearches.length])

  const closeSuggestions = () => {
    blurTimer.current = setTimeout(() => setIsOpen(false), 120)
  }

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => {
      setIsFocused(false)
      setIsOpen(false)
    }, 120)
  }

  const keepSuggestionsOpen = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const showRecentSearches = query.trim().length < 2
    const navigableItems = showRecentSearches
      ? recentSearches.length
      : suggestions.length

    if (event.key === "Enter" && activeIndex < 0 && query.trim()) {
      event.preventDefault()
      runCatalogSearch(query)
      return
    }

    if (!isOpen || !navigableItems) {
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) =>
        current >= navigableItems - 1 ? 0 : current + 1
      )
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) =>
        current <= 0 ? navigableItems - 1 : current - 1
      )
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault()
      if (showRecentSearches) {
        const recentSearch = recentSearches[activeIndex]
        runCatalogSearch(recentSearch)
      } else {
        saveRecentSearch(query)
        router.push(
          `/${countryCode}/products/${suggestions[activeIndex].handle}`
        )
      }
    } else if (event.key === "Escape") {
      setIsOpen(false)
    }
  }

  const hero = variant === "hero"
  const showRecentSearches =
    query.trim().length < 2 && recentSearches.length > 0

  return (
    <div
      className="relative w-full"
      onMouseEnter={keepSuggestionsOpen}
      onMouseLeave={closeSuggestions}
    >
      <form
        action={`/${countryCode}/store`}
        onSubmit={(event) => {
          event.preventDefault()
          runCatalogSearch(query)
        }}
        className={clx(
          "flex w-full overflow-hidden rounded-xl border shadow-sm",
          hero
            ? "border-white/25 bg-white/10 backdrop-blur"
            : "border-ui-border-base bg-white"
        )}
      >
        <label htmlFor={`${listboxId}-input`} className="sr-only">
          Buscar por código, nome ou aplicação
        </label>
        <input
          id={`${listboxId}-input`}
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            setIsFocused(true)
            setIsOpen(
              recentSearches.length > 0 || suggestions.length > 0 || isLoading
            )
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Código, nome, máquina ou aplicação"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          className={clx(
            "min-w-0 flex-1 bg-transparent px-4 py-3.5 outline-none small:px-5",
            hero
              ? "text-white placeholder:text-white/60"
              : "text-ui-fg-base placeholder:text-ui-fg-muted"
          )}
        />
        <button
          type="submit"
          className={clx(
            "min-w-24 px-5 py-3 text-sm font-semibold transition-colors",
            hero
              ? "bg-white text-[#0B6B3F] hover:bg-white/90"
              : "bg-[#0B6B3F] text-white hover:bg-[#08552e]"
          )}
        >
          Buscar
        </button>
      </form>

      {isOpen && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[70] overflow-hidden rounded-xl border border-ui-border-base bg-white text-left shadow-xl">
          <div className="flex items-center justify-between border-b border-ui-border-base px-4 py-2.5 text-xs text-ui-fg-muted">
            <span>
              {showRecentSearches
                ? "Pesquisas recentes"
                : isLoading
                ? "Buscando no catálogo..."
                : "Sugestões"}
            </span>
            {showRecentSearches ? (
              <button
                type="button"
                onClick={clearRecentSearches}
                className="font-medium text-[#0B6B3F] hover:underline"
              >
                Limpar
              </button>
            ) : (
              <span>Use ↑ ↓ para navegar</span>
            )}
          </div>
          <ul
            id={listboxId}
            role="listbox"
            className="max-h-96 overflow-y-auto"
          >
            {showRecentSearches &&
              recentSearches.map((recentSearch, index) => (
                <li
                  id={`${listboxId}-${index}`}
                  key={recentSearch}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <LocalizedClientLink
                    href={`/store?q=${encodeURIComponent(recentSearch)}`}
                    onClick={() => {
                      saveRecentSearch(recentSearch)
                      setIsOpen(false)
                    }}
                    className={clx(
                      "flex items-center gap-3 border-b border-ui-border-base px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-[#f1f8f4]",
                      index === activeIndex && "bg-[#f1f8f4]"
                    )}
                  >
                    <Recent
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-ui-fg-muted"
                    />
                    <span className="min-w-0 flex-1 truncate text-ui-fg-base">
                      {recentSearch}
                    </span>
                    <span className="text-[#0B6B3F]">↗</span>
                  </LocalizedClientLink>
                </li>
              ))}
            {!showRecentSearches && !isLoading && suggestions.length === 0 && (
              <li className="px-4 py-5 text-sm text-ui-fg-subtle">
                Nenhuma sugestão. Pressione Buscar para pesquisar o catálogo.
              </li>
            )}
            {suggestions.map((suggestion, index) => (
              <li
                id={`${listboxId}-${index}`}
                key={suggestion.id}
                role="option"
                aria-selected={index === activeIndex}
              >
                <LocalizedClientLink
                  href={`/products/${suggestion.handle}`}
                  onClick={() => saveRecentSearch(query)}
                  className={clx(
                    "flex items-center gap-3 border-b border-ui-border-base px-4 py-3 transition-colors last:border-b-0 hover:bg-[#f1f8f4]",
                    index === activeIndex && "bg-[#f1f8f4]"
                  )}
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
                    {suggestion.thumbnail ? (
                      <Image
                        src={suggestion.thumbnail}
                        alt=""
                        fill
                        unoptimized={suggestion.thumbnail.includes(".r2.dev/")}
                        sizes="48px"
                        className="object-contain"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center font-mono text-[10px] text-ui-fg-muted">
                        {suggestion.code.slice(0, 6)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ui-fg-base">
                      {suggestion.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ui-fg-muted">
                      <span className="font-mono font-semibold text-[#0B6B3F]">
                        {suggestion.code}
                      </span>
                      {suggestion.category && (
                        <span>{suggestion.category}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[#0B6B3F]">→</span>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
          {!showRecentSearches && (
            <LocalizedClientLink
              href={`/store?q=${encodeURIComponent(query)}`}
              onClick={() => saveRecentSearch(query)}
              className="block bg-ui-bg-subtle px-4 py-3 text-center text-sm font-semibold text-[#0B6B3F] hover:underline"
            >
              Ver todos os resultados
            </LocalizedClientLink>
          )}
        </div>
      )}
    </div>
  )
}

export default SearchAutocomplete
