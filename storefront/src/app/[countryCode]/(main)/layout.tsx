import { Metadata } from "next"

import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getBaseURL } from "@lib/util/env"
import { StoreCartShippingOption } from "@medusajs/types"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import QuoteListDrawer from "@modules/quote-list/components/quote-list-drawer"
import { QuoteListProvider } from "@modules/quote-list/context/quote-list-context"
import { RecentlyViewedProvider } from "@modules/recently-viewed/context/recently-viewed-context"
import { CompareProvider } from "@modules/compare/context/compare-context"
import CompareTray from "@modules/compare/components/compare-tray"
import SavedProductsDrawer from "@modules/saved-products/components/saved-products-drawer"
import { SavedProductsProvider } from "@modules/saved-products/context/saved-products-context"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  const customer = await retrieveCustomer()
  const cart = await retrieveCart()
  let shippingOptions: StoreCartShippingOption[] = []

  if (cart) {
    const { shipping_options } = await listCartOptions()

    shippingOptions = shipping_options
  }

  return (
    <RecentlyViewedProvider>
      <CompareProvider>
        <SavedProductsProvider>
          <QuoteListProvider>
            <Nav />
            {customer && cart && (
              <CartMismatchBanner customer={customer} cart={cart} />
            )}

            {cart && (
              <FreeShippingPriceNudge
                variant="popup"
                cart={cart}
                shippingOptions={shippingOptions}
              />
            )}
            {props.children}
            <CompareTray />
            <SavedProductsDrawer />
            <QuoteListDrawer />
            <Footer />
          </QuoteListProvider>
        </SavedProductsProvider>
      </CompareProvider>
    </RecentlyViewedProvider>
  )
}
