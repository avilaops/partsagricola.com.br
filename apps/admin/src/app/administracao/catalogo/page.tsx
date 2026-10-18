import {
  createApiClient,
  type CatalogAdminEntity,
  type CatalogAdminRecord,
} from "@partsagricola/api-client";
import { cookies } from "next/headers";
import { CatalogAdmin } from "./catalog-admin";
import "./catalog-admin.css";

const evidenceParts: CatalogAdminRecord[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Bomba hidráulica MF 290",
    slug: "bomba-hidraulica-mf-290",
    brandName: "Massey Ferguson",
    categoryName: "Hidráulica",
    active: true,
    updatedAt: "2026-10-18T10:00:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Filtro de combustível 26560143",
    slug: "filtro-combustivel-26560143",
    brandName: "Perkins",
    categoryName: "Filtragem",
    active: true,
    updatedAt: "2026-10-17T15:30:00Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Rolamento de rolos 32210",
    slug: "rolamento-rolos-32210",
    brandName: "SKF",
    categoryName: "Transmissão",
    active: false,
    updatedAt: "2026-10-15T09:20:00Z",
  },
];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ evidence?: string }>;
}) {
  const evidence =
    (await searchParams).evidence === "1" &&
    process.env.NODE_ENV !== "production";
  const entities: CatalogAdminEntity[] = [
    "machine-types",
    "brands",
    "brand-associations",
    "models",
    "categories",
    "parts",
    "codes",
    "compatibilities",
    "exchange-rates",
  ];
  const initialCatalog = Object.fromEntries(
    entities.map((entity) => [
      entity,
      entity === "parts" && evidence ? evidenceParts : [],
    ]),
  ) as Record<CatalogAdminEntity, CatalogAdminRecord[]>;
  let loadError = "";
  if (!evidence) {
    const token = (await cookies()).get("pa_access")?.value;
    if (token) {
      try {
        const client = createApiClient({
          baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
        });
        const responses = await Promise.all(
          entities.map((entity) => client.listCatalogAdmin(entity, token)),
        );
        responses.forEach((response, index) => {
          initialCatalog[entities[index]!] = response.data;
        });
      } catch (error) {
        loadError =
          error instanceof Error
            ? error.message
            : "Falha ao carregar o catálogo";
      }
    }
  }
  return (
    <CatalogAdmin
      initialCatalog={initialCatalog}
      evidence={evidence}
      loadError={loadError}
    />
  );
}
