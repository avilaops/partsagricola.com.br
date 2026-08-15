"use client"

import { TechnicalAttribute } from "@lib/util/product-technical"
import { createContext, useContext, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "agricola_compare_list_v1"
const MAX_ITEMS = 4

export type CompareProduct = {
  id: string
  handle: string
  title: string
  code: string
  thumbnail?: string | null
  attributes: TechnicalAttribute[]
}

type CompareContextValue = {
  items: CompareProduct[]
  isHydrated: boolean
  isOpen: boolean
  addProduct: (product: CompareProduct) => void
  removeProduct: (id: string) => void
  clearProducts: () => void
  hasProduct: (id: string) => boolean
  openCompare: () => void
  closeCompare: () => void
}

const CompareContext = createContext<CompareContextValue | null>(null)

export const CompareProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CompareProduct[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    try {
      const storedItems = window.localStorage.getItem(STORAGE_KEY)

      if (storedItems) {
        const parsedItems = JSON.parse(storedItems) as CompareProduct[]

        if (Array.isArray(parsedItems)) {
          setItems(parsedItems.slice(0, MAX_ITEMS))
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    } finally {
      setIsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (isHydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
  }, [isHydrated, items])

  const value = useMemo<CompareContextValue>(
    () => ({
      items,
      isHydrated,
      isOpen,
      addProduct: (product) => {
        setItems((currentItems) => {
          if (
            currentItems.some((item) => item.id === product.id) ||
            currentItems.length >= MAX_ITEMS
          ) {
            return currentItems
          }

          return [...currentItems, product]
        })
      },
      removeProduct: (id) =>
        setItems((currentItems) =>
          currentItems.filter((item) => item.id !== id)
        ),
      clearProducts: () => setItems([]),
      hasProduct: (id) => items.some((item) => item.id === id),
      openCompare: () => setIsOpen(true),
      closeCompare: () => setIsOpen(false),
    }),
    [isHydrated, isOpen, items]
  )

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export const useCompare = () => {
  const context = useContext(CompareContext)

  if (!context) {
    throw new Error("useCompare must be used within CompareProvider")
  }

  return context
}
