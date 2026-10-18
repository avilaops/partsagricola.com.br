import { createApiClient } from "@partsagricola/api-client";
import { AppShell } from "@partsagricola/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoListings } from "../../../seo-listings";

const api = () =>
  createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  });
export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string; estado: string }>;
}): Promise<Metadata> {
  const { categoria, estado } = await params;
  const taxonomy = await api().publicTaxonomy();
  const category = taxonomy.categories.find((item) => item.slug === categoria);
  if (!category) return {};
  return {
    title: `${category.name} agrícola em ${estado.toUpperCase()} | PartsAgrícola`,
    description: `Encontre anúncios de ${category.name.toLowerCase()} para máquinas agrícolas em ${estado.toUpperCase()} e solicite cotações diretamente aos vendedores.`,
    alternates: { canonical: `/pecas/${categoria}/${estado.toLowerCase()}` },
  };
}
export default async function CategoryStatePage({
  params,
}: {
  params: Promise<{ categoria: string; estado: string }>;
}) {
  const { categoria, estado } = await params;
  const taxonomy = await api().publicTaxonomy();
  const category = taxonomy.categories.find((item) => item.slug === categoria);
  if (!category || !/^[a-zA-Z]{2}$/.test(estado)) notFound();
  const { items } = await api().publicCatalog({
    categorySlug: categoria,
    stateCode: estado.toUpperCase(),
  });
  return (
    <AppShell
      area={`${category.name} em ${estado.toUpperCase()}`}
      description={`Compare anúncios de ${category.name.toLowerCase()} publicados por vendedores que atendem ${estado.toUpperCase()}.`}
    >
      <SeoListings items={items} />
    </AppShell>
  );
}
