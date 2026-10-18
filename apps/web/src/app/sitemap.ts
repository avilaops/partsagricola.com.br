import { createApiClient } from "@partsagricola/api-client";
import type { MetadataRoute } from "next";

const states = ["sp", "mg", "pr", "rs", "go", "mt", "ms", "ba", "sc"];
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://partsagricola.com.br";
  const taxonomy = await createApiClient({
    baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
  }).publicTaxonomy();
  return [
    { url: origin, priority: 1 },
    { url: `${origin}/catalogo`, priority: 0.9 },
    ...taxonomy.categories.flatMap((category) =>
      states.map((state) => ({
        url: `${origin}/pecas/${category.slug}/${state}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    ),
    ...taxonomy.brands.map((brand) => ({
      url: `${origin}/marcas/${brand.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
