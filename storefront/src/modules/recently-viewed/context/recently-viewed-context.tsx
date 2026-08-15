"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

const STORAGE_KEY = "agricola_recently_viewed_v1"
const MAX_ITEMS = 8

export type RecentlyViewedProduct = {
  id: string
  handle: string
  title: string
  code: string
  thumbnail?: string | null
}

type RecentlyViewedContextValue = {
  items: RecentlyViewedProduct[]
  isHydrated: boolean
  addProduct: (product: RecentlyViewedProduct) => void
  clearProducts: () => void
}

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(
  null
)

export const RecentlyViewedProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [items, setItems] = useState<RecentlyViewedProduct[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const storedItems = window.localStorage.getItem(STORAGE_KEY)

      if (storedItems) {
        const parsedItems = JSON.parse(storedItems) as RecentlyViewedProduct[]

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

  const addProduct = useCallback((product: RecentlyViewedProduct) => {
    setItems((currentItems) => {
      if (currentItems[0]?.id === product.id) {
        return currentItems
      }

      return [
        product,
        ...currentItems.filter((item) => item.id !== product.id),
      ].slice(0, MAX_ITEMS)
    })
  }, [])

  const clearProducts = useCallback(() => setItems([]), [])

  const value = useMemo(
    () => ({ items, isHydrated, addProduct, clearProducts }),
    [addProduct, clearProducts, isHydrated, items]
  )

  return (
    <RecentlyViewedContext.Provider value={value}>
      {children}
    </RecentlyViewedContext.Provider>
  )
}

export const useRecentlyViewed = () => {
  const context = useContext(RecentlyViewedContext)

  if (!context) {
    throw new Error("useRecentlyViewed must be used within RecentlyViewedProvider")
  }

  return context
}
