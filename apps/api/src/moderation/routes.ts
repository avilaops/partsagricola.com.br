import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { AuditRepository } from "../app.ts";
import { ApiError } from "../errors.ts";
import type { DomainContext } from "../modules/index.ts";
import { moderateText } from "./classifier.ts";
import type { ModerationRepository } from "./repository.ts";

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});
const headersSchema = z
  .object({ authorization: z.string().optional() })
  .passthrough();
const flagSchema = z.object({
  id: z.string().uuid(),
  marketId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  contentType: z.enum(["MESSAGE", "LISTING", "STORE", "IMAGE"]),
  contentId: z.string().uuid(),
  decision: z.enum(["ALLOW", "MASK", "BLOCK"]),
  reasons: z.array(z.string()),
  source: z.enum(["SYNC", "ASYNC_TEXT", "ASYNC_OCR", "REPORT", "REVIEW"]),
  status: z.enum(["OPEN", "APPROVED", "REJECTED", "RESOLVED"]),
  redactedExcerpt: z.string().optional(),
  createdAt: z.string().datetime(),
});
const sanctionSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["WARNING", "SUSPENSION", "BLOCK"]),
  reason: z.string(),
  companyId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
});
const policySchema = z
  .object({
    warningThreshold: z.number().int().min(1),
    suspendThreshold: z.number().int().min(1),
    blockThreshold: z.number().int().min(1),
    suspensionHours: z.number().int().min(1).max(8760),
  })
  .refine(
    (value) =>
      value.warningThreshold <= value.suspendThreshold &&
      value.suspendThreshold <= value.blockThreshold,
    "limiares devem ser progressivos",
  );

export async function registerModerationRoutes(
  app: FastifyInstance,
  options: {
    repository: ModerationRepository;
    audit: AuditRepository;
    authenticate(request: FastifyRequest): Promise<void>;
    contextFor(request: FastifyRequest): DomainContext;
  },
) {
  const moderation = app.withTypeProvider<ZodTypeProvider>();
  const staff = async (request: FastifyRequest) => {
    await options.authenticate(request);
    const roles = options.contextFor(request).principal.roles;
    if (!roles.some((role) => role === "ADMIN" || role === "SUPPORT"))
      throw new ApiError(403, "AUTH_FORBIDDEN", "Papel insuficiente");
  };
  const admin = async (request: FastifyRequest) => {
    await options.authenticate(request);
    if (!options.contextFor(request).principal.roles.includes("ADMIN"))
      throw new ApiError(403, "AUTH_FORBIDDEN", "Papel insuficiente");
  };
  moderation.get(
    "/v1/moderation/flags",
    {
      preHandler: staff,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        querystring: z.object({
          status: z
            .enum(["OPEN", "APPROVED", "REJECTED", "RESOLVED"])
            .optional(),
        }),
        response: {
          200: z.object({ data: z.array(flagSchema) }),
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request) => {
      const context = options.contextFor(request);
      const { status } = request.query as {
        status?: "OPEN" | "APPROVED" | "REJECTED" | "RESOLVED";
      };
      return {
        data: await options.repository.listFlags({
          marketId: context.market.id,
          ...(status ? { status } : {}),
        }),
      };
    },
  );
  moderation.post(
    "/v1/moderation/flags/:id/review",
    {
      preHandler: staff,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          outcome: z.enum(["CONFIRMED", "DISMISSED"]),
          note: z.string().trim().min(3).max(1000),
        }),
        response: {
          200: z.object({
            flag: flagSchema,
            sanction: sanctionSchema.optional(),
          }),
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request) => {
      const context = options.contextFor(request);
      const body = request.body as {
        outcome: "CONFIRMED" | "DISMISSED";
        note: string;
      };
      const safeNote = moderateText(body.note).safeText;
      try {
        const result = await options.repository.reviewFlag({
          marketId: context.market.id,
          flagId: (request.params as { id: string }).id,
          reviewerUserId: context.principal.sub,
          outcome: body.outcome,
          note: safeNote,
        });
        await options.audit.record({
          actorUserId: context.principal.sub,
          marketId: context.market.id,
          action: "MODERATION_REVIEWED",
          entityType: "moderation_flag",
          entityId: result.flag.id,
          ip: request.ip,
          diff: { outcome: body.outcome, sanction: result.sanction?.kind },
        });
        return result;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "MODERATION_FLAG_NOT_FOUND"
        )
          throw new ApiError(
            404,
            "MODERATION_FLAG_NOT_FOUND",
            "Ocorrência não encontrada",
          );
        if (
          error instanceof Error &&
          error.message === "MODERATION_FLAG_ALREADY_REVIEWED"
        )
          throw new ApiError(
            409,
            "MODERATION_FLAG_ALREADY_REVIEWED",
            "Ocorrência já revisada",
          );
        throw error;
      }
    },
  );
  moderation.get(
    "/v1/moderation/policy",
    {
      preHandler: staff,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        response: { 200: policySchema, 401: errorSchema, 403: errorSchema },
      },
    },
    async (request) =>
      options.repository.getPolicy(options.contextFor(request).market.id),
  );
  moderation.put(
    "/v1/moderation/policy",
    {
      preHandler: admin,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: policySchema,
        response: {
          200: policySchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request) => {
      const context = options.contextFor(request);
      const policy = await options.repository.updatePolicy({
        ...(request.body as z.infer<typeof policySchema>),
        marketId: context.market.id,
        actorUserId: context.principal.sub,
      });
      await options.audit.record({
        actorUserId: context.principal.sub,
        marketId: context.market.id,
        action: "MODERATION_POLICY_UPDATED",
        entityType: "moderation_policy",
        ip: request.ip,
        diff: policy,
      });
      return policy;
    },
  );
  moderation.get(
    "/v1/moderation/history",
    {
      preHandler: staff,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        querystring: z
          .object({
            companyId: z.string().uuid().optional(),
            userId: z.string().uuid().optional(),
          })
          .refine(
            (value) => Boolean(value.companyId) !== Boolean(value.userId),
            "informe empresa ou usuário",
          ),
        response: {
          200: z.object({
            flags: z.array(flagSchema),
            sanctions: z.array(sanctionSchema),
          }),
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request) => {
      const context = options.contextFor(request);
      return options.repository.history({
        marketId: context.market.id,
        ...(request.query as { companyId?: string; userId?: string }),
      });
    },
  );
}
