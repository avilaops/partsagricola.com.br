import { Metadata } from "next"

import { getBaseURL } from "@lib/util/env"
import LeadTracker from "@modules/analytics/components/lead-tracker"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import QuoteListDrawer from "@modules/quote-list/components/quote-list-drawer"
import { QuoteListProvider } from "@modules/quote-list/context/quote-list-context"
import { RecentlyViewedProvider } from "@modules/recently-viewed/context/recently-viewed-context"
import { CompareProvider } from "@modules/compare/context/compare-context"
import CompareTray from "@modules/compare/components/compare-tray"
import SavedProductsDrawer from "@modules/saved-products/components/saved-products-drawer"
import { SavedProductsProvider } from "@modules/saved-products/context/saved-products-context"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  return (
    <RecentlyViewedProvider>
      <CompareProvider>
        <SavedProductsProvider>
          <QuoteListProvider>
            <LeadTracker />
            <Nav />
            {props.children}
            <CompareTray />
            <SavedProductsDrawer />
            <QuoteListDrawer
              whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(
                /\D/g,
                ""
              )}
            />
            <Footer />
          </QuoteListProvider>
        </SavedProductsProvider>
      </CompareProvider>
    </RecentlyViewedProvider>
  )
}
