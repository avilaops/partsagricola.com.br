import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  createHealthPayload,
  introspectSession,
  type SessionPrincipal,
} from "@partsagricola/shared";
import Fastify, {
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError, errorBody } from "./errors.ts";
import {
  registerMarketplaceRoutes,
  type MarketplaceRepository,
} from "./marketplace.ts";
import { registerDomainModules } from "./modules/index.ts";
import { createPrincipalRateLimiter } from "./rate-limit.ts";

export type Market = { id: string; code: string; domains: string[] };
export type AuditEntry = {
  actorUserId: string;
  sellerId?: string;
  marketId: string;
  action: string;
  entityType: string;
  entityId?: string;
  ip?: string;
  diff?: Record<string, unknown>;
};
export interface AuditRepository {
  record(entry: AuditEntry): Promise<void>;
}
export interface UploadSigner {
  signUpload(input: {
    key: string;
    contentType: string;
    size: number;
  }): Promise<{ key: string; url: string; expiresIn: number }>;
}
export interface ImageJobQueue {
  enqueue(input: {
    sourceKey: string;
    sellerId: string;
    marketId: string;
  }): Promise<{ id: string }>;
}
export type AppOptions = {
  logger?: FastifyServerOptions["logger"];
  allowedOrigins?: string[];
  rateLimitMax?: number;
  authOrigin?: string;
  introspect?: (token: string) => Promise<SessionPrincipal | null>;
  markets?: Market[];
  audit?: AuditRepository;
  uploads?: UploadSigner;
  imageJobs?: ImageJobQueue;
  marketplace?: MarketplaceRepository;
};
type RequestContext = {
  principal: SessionPrincipal;
  market: Market;
  sellerId: string | undefined;
};
const contexts = new WeakMap<FastifyRequest, RequestContext>();
const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});
const headersSchema = z
  .object({
    authorization: z.string().optional(),
    "x-market": z.string().length(2).optional(),
    "x-seller-id": z.string().uuid().optional(),
  })
  .passthrough();

export async function createApp(options: AppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.authorization", "headers.authorization"],
    },
  }).withTypeProvider<ZodTypeProvider>();
  const markets = options.markets ?? [
    {
      id: "00000000-0000-4000-8000-000000000076",
      code: "BR",
      domains: ["partsagricola.com.br"],
    },
  ];
  const allowedOrigins = new Set(
    options.allowedOrigins ?? parseList(process.env.CORS_ALLOWED_ORIGINS),
  );
  const audit = options.audit ?? { record: async () => undefined };
  const rateLimitMax =
    options.rateLimitMax ?? Number(process.env.RATE_LIMIT_MAX ?? 120);
  const principalRateLimit = createPrincipalRateLimiter({
    max: rateLimitMax,
    windowMs: 60_000,
  });
  const introspect =
    options.introspect ??
    ((token: string) =>
      introspectSession(
        options.authOrigin ??
          process.env.AUTH_ORIGIN ??
          "http://127.0.0.1:4101",
        token,
      ));
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send(errorBody("ROUTE_NOT_FOUND", "Rota não encontrada", request.id)),
  );
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError)
      return reply
        .status(error.statusCode)
        .send(errorBody(error.code, error.message, request.id, error.details));
    if ((error as unknown as { statusCode?: number }).statusCode === 429)
      return reply
        .status(429)
        .send(
          errorBody(
            "RATE_LIMITED",
            "Limite de requisições excedido",
            request.id,
          ),
        );
    if ((error as { validation?: unknown }).validation)
      return reply
        .status(400)
        .send(
          errorBody(
            "VALIDATION_ERROR",
            "Requisição inválida",
            request.id,
            (error as { validation: unknown }).validation,
          ),
        );
    request.log.error({ err: error }, "request failed");
    return reply
      .status(500)
      .send(errorBody("INTERNAL_ERROR", "Erro interno", request.id));
  });
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Parts Agrícola API",
        version: "1.0.0",
        description: "API central do marketplace B2B Parts Agrícola",
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, {
    routePrefix: "/v1/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(
        new ApiError(403, "CORS_ORIGIN_FORBIDDEN", "Origem não autorizada"),
        false,
      );
    },
  });
  await app.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (request) => ({
      statusCode: 429,
      ...errorBody(
        "RATE_LIMITED",
        "Limite de requisições excedido",
        request.id,
      ),
    }),
  });
  app.get("/health", { schema: { hide: true } }, async () =>
    createHealthPayload("api"),
  );
  app.get(
    "/v1/health",
    {
      schema: {
        tags: ["system"],
        response: {
          200: z.object({ ok: z.literal(true), service: z.literal("api") }),
        },
      },
    },
    async () => ({ ok: true as const, service: "api" as const }),
  );
  app.get("/v1/openapi.json", { schema: { hide: true } }, async () =>
    app.swagger(),
  );
  async function authenticate(request: FastifyRequest) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer "))
      throw new ApiError(401, "AUTH_REQUIRED", "Autenticação obrigatória");
    const principal = await introspect(authorization.slice(7));
    if (!principal)
      throw new ApiError(401, "AUTH_INVALID", "Sessão inválida ou expirada");
    principalRateLimit.consume(principal.sub);
    const context = {
      principal,
      market: resolveMarket(request, markets),
      sellerId: headerValue(request.headers["x-seller-id"]),
    };
    contexts.set(request, context);
    request.log.info(
      {
        principalId: principal.sub,
        market: context.market.code,
        ...(context.sellerId ? { sellerId: context.sellerId } : {}),
      },
      "request authorized",
    );
  }
  const sessionSchema = z.object({
    active: z.literal(true),
    sub: z.string(),
    sid: z.string(),
    email: z.string().email(),
    email_verified: z.boolean(),
    roles: z.array(z.string()),
    seller_ids: z.array(z.string()),
    scope: z.string(),
  });
  app.get(
    "/v1/session",
    {
      preHandler: authenticate,
      schema: {
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        response: { 200: sessionSchema, 401: errorSchema },
      },
    },
    async (request) => contexts.get(request)!.principal,
  );
  await registerDomainModules(app, {
    authenticate,
    contextFor(request) {
      return contexts.get(request)!;
    },
  });
  await registerMarketplaceRoutes(app, {
    authenticate,
    contextFor(request) {
      return contexts.get(request)!;
    },
    ...(options.marketplace ? { repository: options.marketplace } : {}),
  });
  const uploadBody = z.object({
    fileName: z.string().min(1).max(200),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    size: z
      .number()
      .int()
      .positive()
      .max(Number(process.env.UPLOAD_MAX_BYTES ?? 10_485_760)),
  });
  const uploadResponse = z.object({
    key: z.string(),
    url: z.string().url(),
    expiresIn: z.number().int().positive(),
  });
  app.post(
    "/v1/uploads/sign",
    {
      preHandler: authenticate,
      schema: {
        tags: ["uploads"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: uploadBody,
        response: {
          201: uploadResponse,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const context = contexts.get(request)!;
      if (
        !context.sellerId ||
        !context.principal.seller_ids.includes(context.sellerId)
      )
        throw new ApiError(
          403,
          "SELLER_SCOPE_FORBIDDEN",
          "Acesso à empresa negado",
        );
      if (!options.uploads)
        throw new ApiError(
          503,
          "UPLOAD_UNAVAILABLE",
          "Upload temporariamente indisponível",
        );
      const body = request.body as z.infer<typeof uploadBody>;
      const extension = (
        {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        } as const
      )[body.contentType];
      const key = `uploads/${context.sellerId}/${crypto.randomUUID()}.${extension}`;
      const signed = await options.uploads.signUpload({
        key,
        contentType: body.contentType,
        size: body.size,
      });
      await audit.record({
        actorUserId: context.principal.sub,
        sellerId: context.sellerId,
        marketId: context.market.id,
        action: "UPLOAD_SIGNED",
        entityType: "image",
        ip: request.ip,
        diff: { key, contentType: body.contentType, size: body.size },
      });
      return reply.status(201).send(signed);
    },
  );
  app.post(
    "/v1/uploads/complete",
    {
      preHandler: authenticate,
      schema: {
        tags: ["uploads"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: z.object({
          key: z
            .string()
            .regex(/^uploads\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/),
        }),
        response: {
          202: z.object({ jobId: z.string().uuid() }),
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const context = contexts.get(request)!;
      if (
        !context.sellerId ||
        !context.principal.seller_ids.includes(context.sellerId)
      )
        throw new ApiError(
          403,
          "SELLER_SCOPE_FORBIDDEN",
          "Acesso à empresa negado",
        );
      if (!options.imageJobs)
        throw new ApiError(
          503,
          "IMAGE_QUEUE_UNAVAILABLE",
          "Processamento de imagem indisponível",
        );
      const { key } = request.body as { key: string };
      if (!key.startsWith(`uploads/${context.sellerId}/`))
        throw new ApiError(
          403,
          "SELLER_SCOPE_FORBIDDEN",
          "Arquivo não pertence à empresa",
        );
      const job = await options.imageJobs.enqueue({
        sourceKey: key,
        sellerId: context.sellerId,
        marketId: context.market.id,
      });
      await audit.record({
        actorUserId: context.principal.sub,
        sellerId: context.sellerId,
        marketId: context.market.id,
        action: "UPLOAD_COMPLETED",
        entityType: "image_job",
        entityId: job.id,
        ip: request.ip,
        diff: { key },
      });
      return reply.status(202).send({ jobId: job.id });
    },
  );
  return app;
}
function resolveMarket(request: FastifyRequest, markets: Market[]): Market {
  const query = request.query as { market?: string };
  const explicit = [query.market, headerValue(request.headers["x-market"])]
    .filter(Boolean)
    .map((value) => value!.toUpperCase());
  if (new Set(explicit).size > 1)
    throw new ApiError(
      400,
      "MARKET_CONFLICT",
      "Mercados conflitantes na requisição",
    );
  const host = request.hostname.toLowerCase();
  const byHost = markets.find((market) =>
    market.domains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    ),
  );
  const code = explicit[0] ?? byHost?.code ?? "BR";
  const market = markets.find((candidate) => candidate.code === code);
  if (!market)
    throw new ApiError(404, "MARKET_NOT_FOUND", "Mercado não encontrado");
  if (explicit[0] && byHost && byHost.code !== explicit[0])
    throw new ApiError(
      400,
      "MARKET_CONFLICT",
      "Mercado não corresponde ao domínio",
    );
  return market;
}
function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function parseList(value?: string): string[] {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? ["https://partsagricola.com.br"]
  );
}
