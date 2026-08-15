import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import QuotePanel from "@modules/products/components/quote-panel"
import ProductAlternatives from "@modules/products/components/product-alternatives"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { getProductCode } from "@lib/util/product-technical"
import RecentlyViewedProducts from "@modules/recently-viewed/components/recently-viewed-products"
import RecentlyViewedTracker from "@modules/recently-viewed/components/recently-viewed-tracker"
import ProductMobileActions from "@modules/products/components/product-mobile-actions"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
  alternatives: HttpTypes.StoreProduct[]
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
  alternatives,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  return (
    <>
      <RecentlyViewedTracker
        product={{
          id: product.id,
          handle: product.handle,
          title: product.title,
          code: getProductCode(product),
          thumbnail: product.thumbnail,
        }}
      />
      <div
        className="content-container  flex flex-col small:flex-row small:items-start py-6 relative"
        data-testid="product-container"
      >
        <div className="flex flex-col small:sticky small:top-48 small:py-0 small:max-w-[300px] w-full py-8 gap-y-6">
          <ProductInfo product={product} />
          <ProductTabs product={product} />
        </div>
        <div className="block w-full relative">
          <ImageGallery images={images} productTitle={product.title} />
        </div>
        <div className="flex flex-col small:sticky small:top-48 small:py-0 small:max-w-[300px] w-full py-8 gap-y-12">
          <QuotePanel product={product} />
        </div>
      </div>
      <ProductAlternatives
        product={product}
        alternatives={alternatives}
        region={region}
      />
      <div
        className="content-container my-16 small:my-32"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
      <RecentlyViewedProducts currentProductId={product.id} />
      <div className="h-20 small:hidden" aria-hidden="true" />
      <ProductMobileActions product={product} />
    </>
  )
}

export default ProductTemplate
