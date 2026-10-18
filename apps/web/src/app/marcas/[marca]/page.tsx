import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoListings } from "../../seo-listings";

const api = () =>
  createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
export async function generateMetadata({
  params,
}: {
  params: Promise<{ marca: string }>;
}): Promise<Metadata> {
  const { marca } = await params;
  const taxonomy = await api().publicTaxonomy();
  const brand = taxonomy.brands.find((item) => item.slug === marca);
  if (!brand) return {};
  return {
    title: `Peças ${brand.name} | PartsAgrícola`,
    description: `Encontre peças e componentes ${brand.name} anunciados por vendedores agrícolas verificados.`,
    alternates: { canonical: `/marcas/${marca}` },
  };
}
export default async function BrandPage({
  params,
}: {
  params: Promise<{ marca: string }>;
}) {
  const { marca } = await params;
  const taxonomy = await api().publicTaxonomy();
  const brand = taxonomy.brands.find((item) => item.slug === marca);
  if (!brand) notFound();
  const { items } = await api().publicCatalog({ brandSlug: marca });
  return (
    <AppShell
      area={`Peças ${brand.name}`}
      description={`Anúncios para máquinas ${brand.name}, publicados por empresas do marketplace.`}
    >
      <SeoListings items={items} />
    </AppShell>
  );
}
