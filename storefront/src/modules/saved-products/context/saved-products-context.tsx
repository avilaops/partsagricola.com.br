"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "agricola_saved_products_v1"
const MAX_SAVED_PRODUCTS = 50

export type SavedProduct = {
  id: string
  handle: string
  title: string
  code: string
  thumbnail?: string | null
}

type SavedProductsContextValue = {
  items: SavedProduct[]
  isOpen: boolean
  isHydrated: boolean
  saveProduct: (product: SavedProduct) => void
  removeProduct: (id: string) => void
  clearProducts: () => void
  hasProduct: (id: string) => boolean
  openSaved: () => void
  closeSaved: () => void
}

const SavedProductsContext = createContext<SavedProductsContextValue | null>(
  null
)

export const SavedProductsProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [items, setItems] = useState<SavedProduct[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const storedItems = window.localStorage.getItem(STORAGE_KEY)

      if (storedItems) {
        const parsedItems = JSON.parse(storedItems) as SavedProduct[]

        if (Array.isArray(parsedItems)) {
          setItems(parsedItems.slice(0, MAX_SAVED_PRODUCTS))
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

  const value = useMemo<SavedProductsContextValue>(
    () => ({
      items,
      isOpen,
      isHydrated,
      saveProduct: (product) =>
        setItems((currentItems) => {
          if (currentItems.some((item) => item.id === product.id)) {
            return currentItems
          }

          return [product, ...currentItems].slice(0, MAX_SAVED_PRODUCTS)
        }),
      removeProduct: (id) =>
        setItems((currentItems) =>
          currentItems.filter((item) => item.id !== id)
        ),
      clearProducts: () => setItems([]),
      hasProduct: (id) => items.some((item) => item.id === id),
      openSaved: () => setIsOpen(true),
      closeSaved: () => setIsOpen(false),
    }),
    [isHydrated, isOpen, items]
  )

  return (
    <SavedProductsContext.Provider value={value}>
      {children}
    </SavedProductsContext.Provider>
  )
}

export const useSavedProducts = () => {
  const context = useContext(SavedProductsContext)

  if (!context) {
    throw new Error("useSavedProducts must be used within SavedProductsProvider")
  }

  return context
}
