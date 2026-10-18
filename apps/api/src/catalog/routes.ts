import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Market } from "../app.ts";
import { ApiError } from "../errors.ts";
import {
  categorySchema,
  compatibilitySchema,
  modelSchema,
  partSchema,
  referenceSchema,
  searchQuerySchema,
  searchResultSchema,
  uuidSchema,
} from "./contracts.ts";
import type { CatalogRepository } from "./repository.ts";

const list = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item) });

export async function registerCatalogRoutes(
  app: FastifyInstance,
  options: {
    repository: CatalogRepository;
    resolveMarket(request: FastifyRequest): Market;
  },
) {
  const catalog = app.withTypeProvider<ZodTypeProvider>();
  catalog.get(
    "/v1/catalog/machine-types",
    { schema: { tags: ["catalog"], response: { 200: list(referenceSchema) } } },
    async () => ({ data: await options.repository.listMachineTypes() }),
  );
  catalog.get(
    "/v1/catalog/brands",
    {
      schema: {
        tags: ["catalog"],
        querystring: z.object({ machineTypeId: uuidSchema.optional() }),
        response: { 200: list(referenceSchema) },
      },
    },
    async (request) => ({
      data: await options.repository.listBrands(request.query.machineTypeId),
    }),
  );
  catalog.get(
    "/v1/catalog/models",
    {
      schema: {
        tags: ["catalog"],
        querystring: z.object({
          brandId: uuidSchema.optional(),
          machineTypeId: uuidSchema.optional(),
        }),
        response: { 200: list(modelSchema) },
      },
    },
    async (request) => ({
      data: await options.repository.listModels({
        ...(request.query.brandId ? { brandId: request.query.brandId } : {}),
        ...(request.query.machineTypeId
          ? { machineTypeId: request.query.machineTypeId }
          : {}),
      }),
    }),
  );
  catalog.get(
    "/v1/catalog/years",
    {
      schema: {
        tags: ["catalog"],
        querystring: z.object({ modelId: uuidSchema }),
        response: { 200: z.object({ data: z.array(z.number().int()) }) },
      },
    },
    async (request) => ({
      data: await options.repository.listYears(request.query.modelId),
    }),
  );
  catalog.get(
    "/v1/catalog/categories",
    { schema: { tags: ["catalog"], response: { 200: list(categorySchema) } } },
    async () => ({ data: await options.repository.listCategories() }),
  );
  catalog.get(
    "/v1/catalog/parts/:code",
    {
      schema: {
        tags: ["catalog"],
        params: z.object({ code: z.string().trim().min(1).max(120) }),
        response: { 200: list(partSchema) },
      },
    },
    async (request) => ({
      data: await options.repository.findPartsByCode({
        code: request.params.code,
      }),
    }),
  );
  catalog.get(
    "/v1/catalog/compatibilities",
    {
      schema: {
        tags: ["catalog"],
        querystring: z.object({ partId: uuidSchema }),
        response: { 200: list(compatibilitySchema) },
      },
    },
    async (request) => ({
      data: await options.repository.listCompatibilities(request.query.partId),
    }),
  );
  catalog.get(
    "/v1/catalog/search",
    {
      schema: {
        tags: ["catalog"],
        querystring: searchQuerySchema,
        response: {
          200: z.object({
            data: z.array(searchResultSchema),
            page: z.object({ nextCursor: z.string().nullable() }),
          }),
        },
      },
    },
    async (request) => {
      const query = request.query;
      const market = options.resolveMarket(request);
      const input = {
        marketId: market.id,
        ...(query.q ? { query: query.q } : {}),
        ...(query.machineTypeId ? { machineTypeId: query.machineTypeId } : {}),
        ...(query.brandId ? { brandId: query.brandId } : {}),
        ...(query.modelId ? { modelId: query.modelId } : {}),
        ...(query.year ? { year: query.year } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.condition ? { condition: query.condition } : {}),
        ...(query.state ? { stateCode: query.state } : {}),
        ...(query.city ? { city: query.city } : {}),
        ...(query.priceMin !== undefined ? { priceMin: query.priceMin } : {}),
        ...(query.priceMax !== undefined ? { priceMax: query.priceMax } : {}),
        ...(query.hasWarranty !== undefined
          ? { hasWarranty: query.hasWarranty }
          : {}),
        ...(query.displayCurrency
          ? { displayCurrency: query.displayCurrency }
          : {}),
        sort: query.sort ?? (query.q ? "RELEVANCE" : "NEWEST"),
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      } as const;
      let result;
      try {
        result = await options.repository.search(input);
      } catch (error) {
        if ((error as { code?: string }).code === "INVALID_CATALOG_CURSOR")
          throw new ApiError(
            400,
            "INVALID_CATALOG_CURSOR",
            "Cursor de catálogo inválido",
          );
        throw error;
      }
      return { data: result.data, page: { nextCursor: result.nextCursor } };
    },
  );
}
