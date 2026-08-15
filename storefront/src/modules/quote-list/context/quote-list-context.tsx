"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "agricola_quote_list_v1"
const MAX_ITEMS = 15

export type QuoteListItem = {
  id: string
  handle: string
  title: string
  code: string
  thumbnail?: string | null
  quantity: number
  url: string
}

type QuoteListContextValue = {
  items: QuoteListItem[]
  isOpen: boolean
  addItem: (item: Omit<QuoteListItem, "quantity">) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearItems: () => void
  openList: () => void
  closeList: () => void
  hasItem: (id: string) => boolean
}

const QuoteListContext = createContext<QuoteListContextValue | null>(null)

export const QuoteListProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<QuoteListItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const storedItems = window.localStorage.getItem(STORAGE_KEY)

      if (storedItems) {
        const parsedItems = JSON.parse(storedItems) as QuoteListItem[]

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

  const value = useMemo<QuoteListContextValue>(
    () => ({
      items,
      isOpen,
      addItem: (item) => {
        setItems((currentItems) => {
          if (currentItems.some((currentItem) => currentItem.id === item.id)) {
            return currentItems
          }

          return [...currentItems, { ...item, quantity: 1 }].slice(0, MAX_ITEMS)
        })
      },
      removeItem: (id) => {
        setItems((currentItems) =>
          currentItems.filter((currentItem) => currentItem.id !== id)
        )
      },
      updateQuantity: (id, quantity) => {
        const safeQuantity = Math.max(1, Math.min(999, quantity || 1))

        setItems((currentItems) =>
          currentItems.map((item) =>
            item.id === id ? { ...item, quantity: safeQuantity } : item
          )
        )
      },
      clearItems: () => setItems([]),
      openList: () => setIsOpen(true),
      closeList: () => setIsOpen(false),
      hasItem: (id) => items.some((item) => item.id === id),
    }),
    [isOpen, items]
  )

  return (
    <QuoteListContext.Provider value={value}>
      {children}
    </QuoteListContext.Provider>
  )
}

export const useQuoteList = () => {
  const context = useContext(QuoteListContext)

  if (!context) {
    throw new Error("useQuoteList must be used within QuoteListProvider")
  }

  return context
}
