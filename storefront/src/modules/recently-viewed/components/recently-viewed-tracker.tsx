"use client"

import {
  RecentlyViewedProduct,
  useRecentlyViewed,
} from "@modules/recently-viewed/context/recently-viewed-context"
import { useEffect } from "react"

const RecentlyViewedTracker = ({
  product,
}: {
  product: RecentlyViewedProduct
}) => {
  const { addProduct, isHydrated } = useRecentlyViewed()

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    addProduct(product)
  }, [addProduct, isHydrated, product])

  return null
}

export default RecentlyViewedTracker
