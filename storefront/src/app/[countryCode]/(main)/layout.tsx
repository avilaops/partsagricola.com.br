import { getBaseURL } from "@lib/util/env"
import LeadTracker from "@modules/analytics/components/lead-tracker"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import { CompareProvider } from "@modules/compare/context/compare-context"
import { QuoteListProvider } from "@modules/quote-list/context/quote-list-context"
import { RecentlyViewedProvider } from "@modules/recently-viewed/context/recently-viewed-context"
import { SavedProductsProvider } from "@modules/saved-products/context/saved-products-context"
import type { Metadata } from "next"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function PageLayout(props: { children: React.ReactNode }) {
  return (
    <RecentlyViewedProvider>
      <CompareProvider>
        <SavedProductsProvider>
          <QuoteListProvider>
            <LeadTracker />
            <Nav />
            {props.children}
            <Footer />
          </QuoteListProvider>
        </SavedProductsProvider>
      </CompareProvider>
    </RecentlyViewedProvider>
  )
}
