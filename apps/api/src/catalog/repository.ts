import type {
  Category,
  Compatibility,
  MachineModel,
  Part,
  Reference,
  SearchResult,
  SearchSort,
} from "./contracts.ts";

export type CatalogSearchInput = {
  marketId: string;
  query?: string;
  machineTypeId?: string;
  brandId?: string;
  modelId?: string;
  year?: number;
  categoryId?: string;
  condition?: "NEW" | "USED" | "RECONDITIONED" | "REMANUFACTURED";
  stateCode?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  hasWarranty?: boolean;
  displayCurrency?: string;
  sort: SearchSort;
  cursor?: string;
  limit: number;
};

export interface CatalogRepository {
  listMachineTypes(): Promise<Reference[]>;
  listBrands(machineTypeId?: string): Promise<Reference[]>;
  listModels(input: {
    brandId?: string;
    machineTypeId?: string;
  }): Promise<MachineModel[]>;
  listYears(modelId: string): Promise<number[]>;
  listCategories(): Promise<Category[]>;
  findPartsByCode(input: { code: string }): Promise<Part[]>;
  listCompatibilities(partId: string): Promise<Compatibility[]>;
  search(
    input: CatalogSearchInput,
  ): Promise<{ data: SearchResult[]; nextCursor: string | null }>;
  listAdmin(
    entity: CatalogAdminEntity,
  ): Promise<Array<Record<string, unknown>>>;
  createAdmin(
    entity: CatalogAdminEntity,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  updateAdmin(
    entity: CatalogAdminEntity,
    id: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  deactivateAdmin(
    entity: CatalogAdminEntity,
    id: string,
  ): Promise<Record<string, unknown>>;
  importCatalogCsv(csv: string): Promise<{
    rows: number;
    parts: number;
    codes: number;
    fitments: number;
    links: number;
  }>;
}

export const catalogAdminEntities = [
  "machine-types",
  "brands",
  "brand-associations",
  "models",
  "categories",
  "parts",
  "codes",
  "compatibilities",
  "exchange-rates",
] as const;
export type CatalogAdminEntity = (typeof catalogAdminEntities)[number];

export const emptyCatalogRepository: CatalogRepository = {
  listMachineTypes: async () => [],
  listBrands: async () => [],
  listModels: async () => [],
  listYears: async () => [],
  listCategories: async () => [],
  findPartsByCode: async () => [],
  listCompatibilities: async () => [],
  search: async () => ({ data: [], nextCursor: null }),
  listAdmin: async () => [],
  createAdmin: async (_entity, input) => ({
    id: crypto.randomUUID(),
    ...input,
  }),
  updateAdmin: async (_entity, id, input) => ({ id, ...input }),
  deactivateAdmin: async (_entity, id) => ({ id, active: false }),
  importCatalogCsv: async () => ({
    rows: 0,
    parts: 0,
    codes: 0,
    fitments: 0,
    links: 0,
  }),
};
