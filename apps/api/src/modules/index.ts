import type { SessionPrincipal } from "@partsagricola/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../errors.ts";
import { cursorSchema } from "../pagination.ts";

export const domainModules = [
  "catalog",
  "sellers",
  "listings",
  "requests",
  "proposals",
  "chat",
  "orders",
  "payments",
  "shipping",
  "reviews",
  "moderation",
  "admin",
  "markets",
] as const;

export type DomainContext = {
  principal: SessionPrincipal;
  market: { id: string; code: string };
  sellerId: string | undefined;
};

const sellerModules = new Set([
  "sellers",
  "listings",
  "proposals",
  "orders",
  "payments",
  "shipping",
]);
const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});
const listSchema = z.object({
  data: z.array(z.unknown()),
  page: z.object({ nextCursor: z.string().nullable() }),
  module: z.string(),
  market: z.object({ id: z.string().uuid(), code: z.string().length(2) }),
});
const listQuerySchema = z.object({
  cursor: cursorSchema,
  market: z.string().length(2).optional(),
});
const headersSchema = z
  .object({
    authorization: z.string().optional(),
    "x-market": z.string().length(2).optional(),
    "x-seller-id": z.string().uuid().optional(),
  })
  .passthrough();

export async function registerDomainModules(
  app: FastifyInstance,
  options: {
    authenticate(request: FastifyRequest): Promise<void>;
    contextFor(request: FastifyRequest): DomainContext;
  },
) {
  for (const moduleName of domainModules) {
    if (moduleName === "catalog") continue;
    await app.register(async (scope) => {
      const domain = scope.withTypeProvider<ZodTypeProvider>();
      domain.get(
        `/v1/${moduleName}`,
        {
          preHandler: options.authenticate,
          schema: {
            tags: [moduleName],
            security: [{ bearerAuth: [] }],
            headers: headersSchema,
            querystring: listQuerySchema,
            response: {
              200: listSchema,
              400: errorSchema,
              401: errorSchema,
              403: errorSchema,
            },
          },
        },
        async (request) => {
          const context = options.contextFor(request);
          if (
            moduleName === "admin" &&
            !context.principal.roles.some((role) =>
              ["ADMIN", "SUPPORT", "FINANCE"].includes(role),
            )
          )
            throw new ApiError(403, "AUTH_FORBIDDEN", "Papel insuficiente");
          if (sellerModules.has(moduleName)) {
            if (
              !context.sellerId ||
              !context.principal.seller_ids.includes(context.sellerId)
            )
              throw new ApiError(
                403,
                "SELLER_SCOPE_FORBIDDEN",
                "Acesso à empresa negado",
              );
          }
          return {
            data: [],
            page: { nextCursor: null },
            module: moduleName,
            market: { id: context.market.id, code: context.market.code },
          };
        },
      );
    });
  }
}
