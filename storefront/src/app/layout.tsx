import { getBaseURL } from "@lib/util/env"
import {
  GoogleTagManagerNoScript,
  GoogleTagManagerScript,
} from "@modules/analytics/components/google-tag-manager"
import { Metadata } from "next"
import { Inter, Manrope } from "next/font/google"
import "styles/globals.css"

/**
 * Tipografia da marca (docs/IDENTIDADE-VISUAL.md, seção 3): Manrope 700/800 em
 * títulos, Inter 400/500/600 em interface.
 *
 * O `tailwind.config.js` já listava "Inter" como primeira família da pilha,
 * mas ninguém carregava o arquivo — o site prometia Inter e entregava a fonte
 * do sistema, que é o pior dos dois mundos: a métrica é de uma, o desenho é de
 * outra, e ninguém percebe porque não quebra.
 *
 * `next/font` baixa e serve as duas do próprio domínio no build. Não é só
 * privacidade: elimina a requisição a um terceiro no caminho crítico e reserva
 * a métrica antes da fonte chegar, então o texto não pula quando ela carrega.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
})

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-manrope",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  applicationName: "Parts Agrícola",
  title: {
    default: "Parts Agrícola | Peças agrícolas e industriais",
    template: "%s | Parts Agrícola",
  },
  description:
    "Catálogo de peças para máquinas agrícolas, máquinas pesadas e sistemas de vedação. Busque por código, nome ou aplicação.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/br",
    siteName: "Parts Agrícola",
    title: "Parts Agrícola | Peças agrícolas e industriais",
    description:
      "Catálogo de peças para máquinas agrícolas, máquinas pesadas e sistemas de vedação. Busque por código, nome ou aplicação.",
    images: [
      {
        url: "/opengraph-image.jpg",
        width: 1200,
        height: 630,
        alt: "Parts Agrícola — marketplace de peças para máquinas agrícolas e de construção",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Parts Agrícola | Peças agrícolas e industriais",
    description:
      "Catálogo de peças para máquinas agrícolas, máquinas pesadas e sistemas de vedação. Busque por código, nome ou aplicação.",
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
    <html
      lang="pt-BR"
      data-mode="light"
      className={`${inter.variable} ${manrope.variable}`}
    >
      <body>
        <GoogleTagManagerNoScript />
        <main className="relative">{props.children}</main>
        <GoogleTagManagerScript />
      </body>
    </html>
  )
}
