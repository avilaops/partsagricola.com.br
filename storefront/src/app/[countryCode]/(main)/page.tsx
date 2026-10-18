import type { Metadata } from "next"

import MarketplaceHome from "@modules/home/components/marketplace-home"

export const metadata: Metadata = {
  title: "Marketplace agrícola para empresas e compradores",
  description:
    "A Parts Agrícola conecta empresas anunciantes a compradores do agro. Publique anúncios, encontre fornecedores e negocie em uma plataforma especializada.",
  alternates: {
    canonical: "/br",
    languages: { "pt-BR": "/br" },
  },
}

export default function Home() {
  return <MarketplaceHome />
}
