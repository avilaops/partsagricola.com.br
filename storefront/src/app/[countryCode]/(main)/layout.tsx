import { getBaseURL } from "@lib/util/env"
import LeadTracker from "@modules/analytics/components/lead-tracker"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import type { Metadata } from "next"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function PageLayout(props: { children: React.ReactNode }) {
  return (
    <>
      <LeadTracker />
      <Nav />
      {props.children}
      <Footer />
    </>
  )
}
