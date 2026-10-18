import type { SessionPrincipal } from "@partsagricola/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "./errors.ts";
import type { DomainContext } from "./modules/index.ts";

export type CompanyApplicationInput = {
  cnpj: string;
  legalName: string;
  tradeName: string;
  email: string;
  phone?: string;
  stateCode: string;
  city: string;
  description?: string;
  website?: string;
  categoryIds: string[];
  serviceRegions: string[];
};

export type PartRequestInput = {
  title: string;
  description: string;
  categoryId?: string;
  brandId?: string;
};

export interface MarketplaceRepository {
  createCompanyApplication(
    principal: SessionPrincipal,
    marketId: string,
    input: CompanyApplicationInput,
  ): Promise<{ id: string; status: "PENDING" }>;
  createPartRequest(
    principal: SessionPrincipal,
    input: PartRequestInput,
  ): Promise<{ id: string; status: "OPEN" }>;
  sellerDashboard(companyId: string): Promise<{
    company: { id: string; tradeName: string; status: string };
    metrics: {
      listings: number;
      publishedListings: number;
      openInterests: number;
      openRequests: number;
    };
  }>;
  referenceData(): Promise<{
    categories: Array<{ id: string; name: string }>;
    brands: Array<{ id: string; name: string }>;
  }>;
}

const headersSchema = z
  .object({
    authorization: z.string().optional(),
    "x-market": z.string().length(2).optional(),
    "x-seller-id": z.string().uuid().optional(),
  })
  .passthrough();
const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});
const companyInput = z.object({
  cnpj: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().length(14)),
  legalName: z.string().trim().min(3).max(180),
  tradeName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(30).optional(),
  stateCode: z.string().trim().toUpperCase().length(2),
  city: z.string().trim().min(2).max(120),
  description: z.string().trim().min(20).max(1200).optional(),
  website: z.string().trim().url().optional(),
  categoryIds: z.array(z.string().uuid()).min(1).max(20),
  serviceRegions: z.array(z.string().length(2)).min(1).max(27),
});
const requestInput = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(3000),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
});

export async function registerMarketplaceRoutes(
  app: FastifyInstance,
  options: {
    authenticate(request: FastifyRequest): Promise<void>;
    contextFor(request: FastifyRequest): DomainContext;
    repository?: MarketplaceRepository;
  },
) {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const repository = () => {
    if (!options.repository)
      throw new ApiError(
        503,
        "MARKETPLACE_UNAVAILABLE",
        "Marketplace temporariamente indisponível",
      );
    return options.repository;
  };

  api.get(
    "/v1/catalog/reference-data",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["catalog"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        response: {
          200: z.object({
            categories: z.array(
              z.object({ id: z.string().uuid(), name: z.string() }),
            ),
            brands: z.array(
              z.object({ id: z.string().uuid(), name: z.string() }),
            ),
          }),
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async () => repository().referenceData(),
  );

  api.post(
    "/v1/sellers/applications",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["sellers"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: companyInput,
        response: {
          201: z.object({
            id: z.string().uuid(),
            status: z.literal("PENDING"),
          }),
          400: errorSchema,
          401: errorSchema,
          409: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const context = options.contextFor(request);
      const result = await repository().createCompanyApplication(
        context.principal,
        context.market.id,
        request.body as CompanyApplicationInput,
      );
      return reply.status(201).send(result);
    },
  );

  api.post(
    "/v1/requests",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["requests"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: requestInput,
        response: {
          201: z.object({ id: z.string().uuid(), status: z.literal("OPEN") }),
          400: errorSchema,
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const context = options.contextFor(request);
      const result = await repository().createPartRequest(
        context.principal,
        request.body as PartRequestInput,
      );
      return reply.status(201).send(result);
    },
  );

  api.get(
    "/v1/sellers/dashboard",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["sellers"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        response: {
          200: z.object({
            company: z.object({
              id: z.string().uuid(),
              tradeName: z.string(),
              status: z.string(),
            }),
            metrics: z.object({
              listings: z.number().int(),
              publishedListings: z.number().int(),
              openInterests: z.number().int(),
              openRequests: z.number().int(),
            }),
          }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request) => {
      const context = options.contextFor(request);
      if (
        !context.sellerId ||
        !context.principal.seller_ids.includes(context.sellerId)
      )
        throw new ApiError(
          403,
          "SELLER_SCOPE_FORBIDDEN",
          "Acesso à empresa negado",
        );
      return repository().sellerDashboard(context.sellerId);
    },
  );
}
