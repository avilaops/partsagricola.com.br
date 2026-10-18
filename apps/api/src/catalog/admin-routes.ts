import { parseCatalogCsv } from "@partsagricola/db/catalog-import";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { AuditRepository } from "../app.ts";
import { ApiError } from "../errors.ts";
import { uuidSchema } from "./contracts.ts";
import {
  catalogAdminEntities,
  type CatalogAdminEntity,
  type CatalogRepository,
} from "./repository.ts";

const entitySchema = z.enum(catalogAdminEntities);
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nameSchema = z.string().trim().min(1).max(160);
const schemas: Record<CatalogAdminEntity, z.ZodObject<z.ZodRawShape>> = {
  "machine-types": z.object({
    name: nameSchema,
    slug: slugSchema,
    active: z.boolean().optional(),
  }),
  brands: z.object({
    name: nameSchema,
    slug: slugSchema,
    logoUrl: z.string().url().nullable().optional(),
    active: z.boolean().optional(),
  }),
  "brand-associations": z.object({
    machineTypeId: uuidSchema,
    brandId: uuidSchema,
    active: z.boolean().optional(),
  }),
  models: z.object({
    machineTypeId: uuidSchema,
    brandId: uuidSchema,
    name: nameSchema,
    slug: slugSchema,
    yearStart: z.number().int().min(1900).max(2200).nullable().optional(),
    yearEnd: z.number().int().min(1900).max(2200).nullable().optional(),
    active: z.boolean().optional(),
  }),
  categories: z.object({
    parentId: uuidSchema.nullable().optional(),
    name: nameSchema,
    slug: slugSchema,
    active: z.boolean().optional(),
  }),
  parts: z.object({
    categoryId: uuidSchema.nullable().optional(),
    brandId: uuidSchema.nullable().optional(),
    name: nameSchema,
    slug: slugSchema,
    description: z.string().max(5000).nullable().optional(),
    specifications: z.record(z.unknown()).optional(),
    active: z.boolean().optional(),
  }),
  codes: z.object({
    partId: uuidSchema,
    code: z.string().trim().min(1).max(120),
    kind: z.enum(["ORIGINAL", "EQUIVALENT", "OEM", "GTIN", "SUPPLIER"]),
    source: z.string().max(120).nullable().optional(),
    active: z.boolean().optional(),
  }),
  compatibilities: z.object({
    partId: uuidSchema,
    modelId: uuidSchema,
    yearStart: z.number().int().min(1900).max(2200).nullable().optional(),
    yearEnd: z.number().int().min(1900).max(2200).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    active: z.boolean().optional(),
  }),
  "exchange-rates": z.object({
    baseCurrency: z.string().length(3),
    quoteCurrency: z.string().length(3),
    rate: z.coerce.number().positive(),
    effectiveAt: z.string().datetime(),
  }),
};
const anyBody = z.record(z.unknown());
const headersSchema = z
  .object({ authorization: z.string().optional() })
  .passthrough();
const responseSchema = z.record(z.unknown());

export async function registerCatalogAdminRoutes(
  app: FastifyInstance,
  options: {
    repository: CatalogRepository;
    audit: AuditRepository;
    authenticate(request: FastifyRequest): Promise<void>;
    contextFor(request: FastifyRequest): {
      principal: { sub: string; roles: string[] };
      market: { id: string };
    };
  },
) {
  const admin = app.withTypeProvider<ZodTypeProvider>();
  const authorize = async (request: FastifyRequest) => {
    await options.authenticate(request);
    const context = options.contextFor(request);
    if (
      !context.principal.roles.some(
        (role) => role === "ADMIN" || role === "SUPPORT",
      )
    ) {
      throw new ApiError(403, "AUTH_FORBIDDEN", "Papel insuficiente");
    }
  };
  const params = z.object({ entity: entitySchema });
  const idParams = params.extend({ id: uuidSchema });

  admin.get(
    "/v1/admin/catalog/:entity",
    {
      preHandler: authorize,
      schema: {
        tags: ["admin", "catalog"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params,
        response: { 200: z.object({ data: z.array(responseSchema) }) },
      },
    },
    async (request) => ({
      data: await options.repository.listAdmin(request.params.entity),
    }),
  );
  admin.post(
    "/v1/admin/catalog/:entity",
    {
      preHandler: authorize,
      schema: {
        tags: ["admin", "catalog"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params,
        body: anyBody,
        response: { 201: responseSchema },
      },
    },
    async (request, reply) => {
      const body = parseBody(request.params.entity, request.body, false);
      const result = await repositoryCall(() =>
        options.repository.createAdmin(request.params.entity, body),
      );
      await record(
        options,
        request,
        request.params.entity,
        result.id as string,
        "CATALOG_CREATED",
        body,
      );
      return reply.status(201).send(result);
    },
  );
  admin.patch(
    "/v1/admin/catalog/:entity/:id",
    {
      preHandler: authorize,
      schema: {
        tags: ["admin", "catalog"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: idParams,
        body: anyBody,
        response: { 200: responseSchema },
      },
    },
    async (request) => {
      const body = parseBody(request.params.entity, request.body, true);
      const result = await repositoryCall(() =>
        options.repository.updateAdmin(
          request.params.entity,
          request.params.id,
          body,
        ),
      );
      await record(
        options,
        request,
        request.params.entity,
        request.params.id,
        "CATALOG_UPDATED",
        body,
      );
      return result;
    },
  );
  admin.delete(
    "/v1/admin/catalog/:entity/:id",
    {
      preHandler: authorize,
      schema: {
        tags: ["admin", "catalog"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: idParams,
        response: { 200: responseSchema },
      },
    },
    async (request) => {
      const result = await repositoryCall(() =>
        options.repository.deactivateAdmin(
          request.params.entity,
          request.params.id,
        ),
      );
      await record(
        options,
        request,
        request.params.entity,
        request.params.id,
        "CATALOG_DEACTIVATED",
        { active: false },
      );
      return result;
    },
  );
  admin.post(
    "/v1/admin/catalog/imports",
    {
      preHandler: authorize,
      schema: {
        tags: ["admin", "catalog"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: z.object({ csv: z.string().min(1).max(10_000_000) }),
        response: {
          201: z.object({
            rows: z.number().int(),
            parts: z.number().int(),
            codes: z.number().int(),
            fitments: z.number().int(),
            links: z.number().int(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        parseCatalogCsv(request.body.csv);
      } catch (error) {
        throw new ApiError(
          400,
          "CATALOG_CSV_INVALID",
          error instanceof Error ? error.message : "CSV inválido",
        );
      }
      const result = await repositoryCall(() =>
        options.repository.importCatalogCsv(request.body.csv),
      );
      await record(
        options,
        request,
        "import",
        undefined,
        "CATALOG_IMPORTED",
        result,
      );
      return reply.status(201).send(result);
    },
  );
}

function parseBody(
  entity: CatalogAdminEntity,
  body: unknown,
  partial: boolean,
): Record<string, unknown> {
  const schema = partial ? schemas[entity].partial() : schemas[entity];
  const result = schema.safeParse(body);
  if (!result.success || (partial && Object.keys(result.data).length === 0)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Requisição inválida",
      result.success ? undefined : result.error.flatten(),
    );
  }
  return result.data;
}

async function repositoryCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505")
      throw new ApiError(409, "CATALOG_CONFLICT", "Referência já existe");
    if (code === "23503")
      throw new ApiError(
        400,
        "CATALOG_REFERENCE_INVALID",
        "Referência relacionada inválida",
      );
    if (code === "23514")
      throw new ApiError(
        400,
        "CATALOG_CONSTRAINT_INVALID",
        "Dados incompatíveis com o catálogo",
      );
    throw error;
  }
}

async function record(
  options: Parameters<typeof registerCatalogAdminRoutes>[1],
  request: FastifyRequest,
  entity: string,
  id: string | undefined,
  action: string,
  diff: Record<string, unknown>,
) {
  const context = options.contextFor(request);
  await options.audit.record({
    actorUserId: context.principal.sub,
    marketId: context.market.id,
    action,
    entityType: `catalog_${entity.replace(/s$/, "").replaceAll("-", "_")}`,
    ...(id ? { entityId: id } : {}),
    ip: request.ip,
    diff,
  });
}
