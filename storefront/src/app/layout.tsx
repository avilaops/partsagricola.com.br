import { getBaseURL } from "@lib/util/env"
import {
  GoogleTagManagerNoScript,
  GoogleTagManagerScript,
} from "@modules/analytics/components/google-tag-manager"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  applicationName: "Parts Agrícola",
  title: {
    default: "Parts Agrícola | Marketplace das empresas do agro",
    template: "%s | Parts Agrícola",
  },
  description:
    "Marketplace que conecta empresas anunciantes a compradores do setor agrícola.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/br",
    siteName: "Parts Agrícola",
    title: "Parts Agrícola | Marketplace das empresas do agro",
    description:
      "Empresas anunciam e compradores encontram oportunidades no marketplace agrícola.",
    images: [
      {
        url: "/opengraph-image.jpg",
        width: 1200,
        height: 630,
        alt: "Parts Agrícola — marketplace das empresas do agro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Parts Agrícola | Marketplace das empresas do agro",
    description:
      "Empresas anunciam e compradores encontram oportunidades no marketplace agrícola.",
    images: ["/twitter-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-mode="light">
      <body>
        <GoogleTagManagerNoScript />
        <main className="relative">{props.children}</main>
        <GoogleTagManagerScript />
      </body>
    </html>
  )
}
