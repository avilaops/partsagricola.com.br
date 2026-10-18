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
export type ListingInput = {
  title: string;
  description: string;
  condition: "NEW" | "USED" | "RECONDITIONED" | "REMANUFACTURED";
  stateCode: string;
  city: string;
  partId?: string | undefined;
  priceAmountMinor?: number | undefined;
  priceOnRequest: boolean;
  imageUrls: string[];
};
export type CatalogFilters = {
  query?: string | undefined;
  categoryId?: string | undefined;
  brandId?: string | undefined;
  stateCode?: string | undefined;
  categorySlug?: string | undefined;
  brandSlug?: string | undefined;
};
export type ListingSummary = {
  id: string;
  title: string;
  description: string;
  condition: string;
  priceAmountMinor: number | null;
  priceOnRequest: boolean;
  stateCode: string;
  city: string;
  imageUrl: string | null;
  company: { tradeName: string; slug: string; verified: boolean };
};
export type ListingDetail = ListingSummary & {
  images: Array<{ url: string; altText: string }>;
  company: ListingSummary["company"] & {
    city: string;
    stateCode: string;
    rating: number | null;
    reviewCount: number;
  };
  part: {
    name: string;
    brand: string | null;
    category: string | null;
    codes: string[];
  } | null;
};
export type InterestSummary = {
  id: string;
  status: string;
  message: string | null;
  listing: { id: string; title: string };
  buyer: { name: string; email: string };
  latestProposal: {
    id: string;
    amountMinor: number | null;
    terms: string;
    status: string;
  } | null;
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
  publicCatalog(filters: CatalogFilters): Promise<{ items: ListingSummary[] }>;
  publicListing(id: string): Promise<ListingDetail>;
  publicTaxonomy(): Promise<{
    categories: Array<{ name: string; slug: string }>;
    brands: Array<{ name: string; slug: string }>;
  }>;
  publicSeller(slug: string): Promise<{
    company: {
      tradeName: string;
      slug: string;
      description: string | null;
      city: string;
      stateCode: string;
      verified: boolean;
      categories: string[];
      serviceRegions: string[];
      rating: number | null;
      reviewCount: number;
    };
    listings: ListingSummary[];
  }>;
  sellerListings(
    companyId: string,
  ): Promise<{ items: Array<ListingSummary & { status: string }> }>;
  createListing(
    companyId: string,
    input: ListingInput,
  ): Promise<{ id: string; status: "PENDING_REVIEW" }>;
  createInterest(
    principal: SessionPrincipal,
    listingId: string,
    message?: string,
  ): Promise<{ id: string; status: "OPEN" }>;
  buyerInterests(userId: string): Promise<{ items: InterestSummary[] }>;
  sellerInterests(companyId: string): Promise<{ items: InterestSummary[] }>;
  createSellerProposal(
    principal: SessionPrincipal,
    companyId: string,
    interestId: string,
    input: { amountMinor?: number | undefined; terms: string },
  ): Promise<{ id: string; status: "SENT" }>;
  decideProposal(
    userId: string,
    proposalId: string,
    decision: "ACCEPTED" | "REJECTED",
  ): Promise<{ id: string; status: "ACCEPTED" | "REJECTED" }>;
  createReview(
    principal: SessionPrincipal,
    proposalId: string,
    input: { rating: number; comment?: string | undefined },
  ): Promise<{ id: string; status: "PUBLISHED" }>;
  createModerationCase(
    principal: SessionPrincipal,
    input: {
      entityType: "COMPANY" | "LISTING" | "REVIEW";
      entityId: string;
      reason: string;
    },
  ): Promise<{ id: string; status: "OPEN" }>;
  adminModeration(): Promise<{
    companies: Array<{
      id: string;
      tradeName: string;
      cnpj: string;
      city: string;
      stateCode: string;
      status: string;
    }>;
    listings: Array<{
      id: string;
      title: string;
      companyName: string;
      status: string;
    }>;
    cases: Array<{
      id: string;
      entityType: string;
      entityId: string;
      reason: string;
      status: string;
    }>;
  }>;
  moderateCompany(
    principal: SessionPrincipal,
    id: string,
    decision: "APPROVED" | "REJECTED",
  ): Promise<{ id: string; status: string }>;
  moderateListing(
    principal: SessionPrincipal,
    id: string,
    decision: "PUBLISHED" | "REJECTED",
  ): Promise<{ id: string; status: string }>;
  resolveModerationCase(
    principal: SessionPrincipal,
    id: string,
    decision: "RESOLVED" | "DISMISSED",
    resolution: string,
  ): Promise<{ id: string; status: string }>;
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
const listingInput = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(3000),
    condition: z.enum(["NEW", "USED", "RECONDITIONED", "REMANUFACTURED"]),
    stateCode: z.string().trim().toUpperCase().length(2),
    city: z.string().trim().min(2).max(120),
    partId: z.string().uuid().optional(),
    priceAmountMinor: z.number().int().nonnegative().optional(),
    priceOnRequest: z.boolean(),
    imageUrls: z.array(z.string().url()).max(8).default([]),
  })
  .superRefine((value, context) => {
    if (!value.priceOnRequest && value.priceAmountMinor === undefined)
      context.addIssue({
        code: "custom",
        message: "Informe o preço",
        path: ["priceAmountMinor"],
      });
  });
const listingSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  condition: z.string(),
  priceAmountMinor: z.number().int().nullable(),
  priceOnRequest: z.boolean(),
  stateCode: z.string(),
  city: z.string(),
  imageUrl: z.string().nullable(),
  company: z.object({
    tradeName: z.string(),
    slug: z.string(),
    verified: z.boolean(),
  }),
});
const listingDetailSchema = listingSummarySchema.extend({
  images: z.array(z.object({ url: z.string(), altText: z.string() })),
  company: listingSummarySchema.shape.company.extend({
    city: z.string(),
    stateCode: z.string(),
    rating: z.number().nullable(),
    reviewCount: z.number().int(),
  }),
  part: z
    .object({
      name: z.string(),
      brand: z.string().nullable(),
      category: z.string().nullable(),
      codes: z.array(z.string()),
    })
    .nullable(),
});
const interestSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  message: z.string().nullable(),
  listing: z.object({ id: z.string().uuid(), title: z.string() }),
  buyer: z.object({ name: z.string(), email: z.string() }),
  latestProposal: z
    .object({
      id: z.string().uuid(),
      amountMinor: z.number().int().nullable(),
      terms: z.string(),
      status: z.string(),
    })
    .nullable(),
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
    "/v1/marketplace/listings",
    {
      schema: {
        tags: ["catalog"],
        querystring: z.object({
          query: z.string().trim().max(120).optional(),
          categoryId: z.string().uuid().optional(),
          brandId: z.string().uuid().optional(),
          stateCode: z.string().length(2).optional(),
          categorySlug: z.string().min(2).max(120).optional(),
          brandSlug: z.string().min(2).max(120).optional(),
        }),
        response: {
          200: z.object({ items: z.array(listingSummarySchema) }),
          503: errorSchema,
        },
      },
    },
    async (request) => repository().publicCatalog(request.query),
  );

  api.get(
    "/v1/marketplace/taxonomy",
    {
      schema: {
        tags: ["catalog"],
        response: {
          200: z.object({
            categories: z.array(
              z.object({ name: z.string(), slug: z.string() }),
            ),
            brands: z.array(z.object({ name: z.string(), slug: z.string() })),
          }),
          503: errorSchema,
        },
      },
    },
    async () => repository().publicTaxonomy(),
  );

  api.get(
    "/v1/marketplace/listings/:id",
    {
      schema: {
        tags: ["catalog"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: listingDetailSchema,
          404: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request) => repository().publicListing(request.params.id),
  );

  api.get(
    "/v1/marketplace/sellers/:slug",
    {
      schema: {
        tags: ["sellers"],
        params: z.object({ slug: z.string().min(2).max(160) }),
        response: {
          200: z.object({
            company: z.object({
              tradeName: z.string(),
              slug: z.string(),
              description: z.string().nullable(),
              city: z.string(),
              stateCode: z.string(),
              verified: z.boolean(),
              categories: z.array(z.string()),
              serviceRegions: z.array(z.string()),
              rating: z.number().nullable(),
              reviewCount: z.number().int(),
            }),
            listings: z.array(listingSummarySchema),
          }),
          404: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request) => repository().publicSeller(request.params.slug),
  );

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
    "/v1/marketplace/listings/:listingId/interests",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["proposals"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: z.object({ listingId: z.string().uuid() }),
        body: z.object({ message: z.string().trim().max(1200).optional() }),
        response: {
          201: z.object({ id: z.string().uuid(), status: z.literal("OPEN") }),
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const context = options.contextFor(request);
      return reply
        .status(201)
        .send(
          await repository().createInterest(
            context.principal,
            request.params.listingId,
            request.body.message,
          ),
        );
    },
  );

  api.get(
    "/v1/account/interests",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["proposals"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        response: {
          200: z.object({ items: z.array(interestSummarySchema) }),
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request) =>
      repository().buyerInterests(options.contextFor(request).principal.sub),
  );

  api.get(
    "/v1/sellers/interests",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["proposals"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        response: {
          200: z.object({ items: z.array(interestSummarySchema) }),
          401: errorSchema,
          403: errorSchema,
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
      return repository().sellerInterests(context.sellerId);
    },
  );

  api.post(
    "/v1/sellers/interests/:interestId/proposals",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["proposals"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: z.object({ interestId: z.string().uuid() }),
        body: z.object({
          amountMinor: z.number().int().nonnegative().optional(),
          terms: z.string().trim().min(3).max(3000),
        }),
        response: {
          201: z.object({ id: z.string().uuid(), status: z.literal("SENT") }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
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
      return reply
        .status(201)
        .send(
          await repository().createSellerProposal(
            context.principal,
            context.sellerId,
            request.params.interestId,
            request.body,
          ),
        );
    },
  );

  api.post(
    "/v1/account/proposals/:proposalId/decision",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["proposals"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: z.object({ proposalId: z.string().uuid() }),
        body: z.object({ decision: z.enum(["ACCEPTED", "REJECTED"]) }),
        response: {
          200: z.object({
            id: z.string().uuid(),
            status: z.enum(["ACCEPTED", "REJECTED"]),
          }),
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request) =>
      repository().decideProposal(
        options.contextFor(request).principal.sub,
        request.params.proposalId,
        request.body.decision,
      ),
  );

  api.post(
    "/v1/account/proposals/:proposalId/review",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["reviews"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: z.object({ proposalId: z.string().uuid() }),
        body: z.object({
          rating: z.number().int().min(1).max(5),
          comment: z.string().trim().min(3).max(1200).optional(),
        }),
        response: {
          201: z.object({
            id: z.string().uuid(),
            status: z.literal("PUBLISHED"),
          }),
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await repository().createReview(
            options.contextFor(request).principal,
            request.params.proposalId,
            request.body,
          ),
        ),
  );

  api.post(
    "/v1/moderation/reports",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: z.object({
          entityType: z.enum(["COMPANY", "LISTING", "REVIEW"]),
          entityId: z.string().uuid(),
          reason: z.string().trim().min(3).max(1200),
        }),
        response: {
          201: z.object({ id: z.string().uuid(), status: z.literal("OPEN") }),
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await repository().createModerationCase(
            options.contextFor(request).principal,
            request.body,
          ),
        ),
  );

  api.get(
    "/v1/admin/moderation",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        response: {
          200: z.object({
            companies: z.array(
              z.object({
                id: z.string().uuid(),
                tradeName: z.string(),
                cnpj: z.string(),
                city: z.string(),
                stateCode: z.string(),
                status: z.string(),
              }),
            ),
            listings: z.array(
              z.object({
                id: z.string().uuid(),
                title: z.string(),
                companyName: z.string(),
                status: z.string(),
              }),
            ),
            cases: z.array(
              z.object({
                id: z.string().uuid(),
                entityType: z.string(),
                entityId: z.string().uuid(),
                reason: z.string(),
                status: z.string(),
              }),
            ),
          }),
          401: errorSchema,
          403: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request) => {
      const context = options.contextFor(request);
      if (
        !context.principal.roles.some((role) =>
          ["ADMIN", "SUPPORT"].includes(role),
        )
      )
        throw new ApiError(403, "AUTH_FORBIDDEN", "Papel insuficiente");
      return repository().adminModeration();
    },
  );

  api.post(
    "/v1/admin/moderation/cases/:id",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          decision: z.enum(["RESOLVED", "DISMISSED"]),
          resolution: z.string().trim().min(3).max(1200),
        }),
        response: {
          200: z.object({ id: z.string().uuid(), status: z.string() }),
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
        !context.principal.roles.some((role) =>
          ["ADMIN", "SUPPORT"].includes(role),
        )
      )
        throw new ApiError(403, "AUTH_FORBIDDEN", "Papel insuficiente");
      return repository().resolveModerationCase(
        context.principal,
        request.params.id,
        request.body.decision,
        request.body.resolution,
      );
    },
  );

  api.post(
    "/v1/admin/moderation/:entity/:id",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: z.object({
          entity: z.enum(["company", "listing"]),
          id: z.string().uuid(),
        }),
        body: z.object({
          decision: z.enum(["APPROVED", "PUBLISHED", "REJECTED"]),
        }),
        response: {
          200: z.object({ id: z.string().uuid(), status: z.string() }),
          400: errorSchema,
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
        !context.principal.roles.some((role) =>
          ["ADMIN", "SUPPORT"].includes(role),
        )
      )
        throw new ApiError(403, "AUTH_FORBIDDEN", "Papel insuficiente");
      if (request.params.entity === "company") {
        if (request.body.decision === "PUBLISHED")
          throw new ApiError(
            400,
            "INVALID_DECISION",
            "Decisão inválida para empresa",
          );
        return repository().moderateCompany(
          context.principal,
          request.params.id,
          request.body.decision,
        );
      }
      if (request.body.decision === "APPROVED")
        throw new ApiError(
          400,
          "INVALID_DECISION",
          "Decisão inválida para anúncio",
        );
      return repository().moderateListing(
        context.principal,
        request.params.id,
        request.body.decision,
      );
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

  api.get(
    "/v1/sellers/listings",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["listings"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        response: {
          200: z.object({
            items: z.array(listingSummarySchema.extend({ status: z.string() })),
          }),
          401: errorSchema,
          403: errorSchema,
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
      return repository().sellerListings(context.sellerId);
    },
  );

  api.post(
    "/v1/sellers/listings",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["listings"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: listingInput,
        response: {
          201: z.object({
            id: z.string().uuid(),
            status: z.literal("PENDING_REVIEW"),
          }),
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
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
      return reply
        .status(201)
        .send(await repository().createListing(context.sellerId, request.body));
    },
  );
}
