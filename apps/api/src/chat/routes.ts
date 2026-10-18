import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { AuditRepository, UploadSigner } from "../app.ts";
import { ApiError } from "../errors.ts";
import { cursorSchema } from "../pagination.ts";
import { moderateText } from "../moderation/classifier.ts";
import type { DomainContext } from "../modules/index.ts";
import type { ChatRepository } from "./repository.ts";

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});
const attachmentSchema = z.object({
  id: z.string().uuid(),
  storageKey: z.string(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  status: z.enum(["QUARANTINED", "APPROVED", "REJECTED", "REVIEW_REQUIRED"]),
  url: z.string().url().optional(),
});
const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderUserId: z.string().uuid(),
  safeBody: z.string(),
  moderationStatus: z.enum(["ALLOW", "MASK", "BLOCK", "PENDING_REVIEW"]),
  reasons: z.array(z.string()),
  attachments: z.array(attachmentSchema),
  readByRecipient: z.boolean(),
  createdAt: z.string().datetime(),
});
const participantMessageSchema = messageSchema.extend({ mine: z.boolean() });
const headersSchema = z
  .object({ authorization: z.string().optional() })
  .passthrough();
const paramsSchema = z.object({ id: z.string().uuid() });

export async function registerChatRoutes(
  app: FastifyInstance,
  options: {
    repository: ChatRepository;
    audit: AuditRepository;
    uploads?: UploadSigner;
    authenticate(request: FastifyRequest): Promise<void>;
    contextFor(request: FastifyRequest): DomainContext;
  },
) {
  const chat = app.withTypeProvider<ZodTypeProvider>();
  const realtimeTickets = new Map<
    string,
    { conversationId: string; expiresAt: number }
  >();
  chat.post(
    "/v1/chat/uploads/sign",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["chat"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: z.object({
          fileName: z.string().min(1).max(200),
          contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
          size: z.number().int().positive().max(10_485_760),
        }),
        response: {
          201: z.object({
            key: z.string(),
            url: z.string().url(),
            expiresIn: z.number().int().positive(),
          }),
          400: errorSchema,
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!options.uploads)
        throw new ApiError(
          503,
          "UPLOAD_UNAVAILABLE",
          "Upload temporariamente indisponível",
        );
      const context = options.contextFor(request);
      const body = request.body as {
        fileName: string;
        contentType: "image/jpeg" | "image/png" | "image/webp";
        size: number;
      };
      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      }[body.contentType];
      const key = `uploads/${context.principal.sub}/${crypto.randomUUID()}.${extension}`;
      const signed = await options.uploads.signUpload({
        key,
        contentType: body.contentType,
        size: body.size,
      });
      await options.audit.record({
        actorUserId: context.principal.sub,
        marketId: context.market.id,
        action: "CHAT_UPLOAD_SIGNED",
        entityType: "message_attachment",
        ip: request.ip,
        diff: { key, contentType: body.contentType, size: body.size },
      });
      return reply.status(201).send(signed);
    },
  );
  chat.post(
    "/v1/chat/conversations/:id/realtime-ticket",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["chat"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: paramsSchema,
        response: {
          201: z.object({
            ticket: z.string().uuid(),
            expiresAt: z.string().datetime(),
          }),
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const context = options.contextFor(request);
      const { id } = request.params as { id: string };
      for (const [key, value] of realtimeTickets)
        if (value.expiresAt <= Date.now()) realtimeTickets.delete(key);
      try {
        await options.repository.listMessages({
          marketId: context.market.id,
          userId: context.principal.sub,
          conversationId: id,
        });
      } catch (error) {
        throw mapChatError(error);
      }
      const ticket = crypto.randomUUID();
      const expiresAt = Date.now() + 60_000;
      realtimeTickets.set(ticket, { conversationId: id, expiresAt });
      return reply.status(201).send({
        ticket,
        expiresAt: new Date(expiresAt).toISOString(),
      });
    },
  );
  chat.get(
    "/v1/chat/conversations/:id/events",
    {
      websocket: true,
      preValidation: async (request) => {
        const { ticket } = request.query as { ticket?: string };
        const issued = ticket ? realtimeTickets.get(ticket) : undefined;
        const { id } = request.params as { id: string };
        if (
          issued &&
          issued.conversationId === id &&
          issued.expiresAt > Date.now()
        ) {
          realtimeTickets.delete(ticket!);
          return;
        }
        await options.authenticate(request);
        const context = options.contextFor(request);
        try {
          await options.repository.listMessages({
            marketId: context.market.id,
            userId: context.principal.sub,
            conversationId: id,
          });
        } catch (error) {
          throw mapChatError(error);
        }
      },
    },
    (socket, request) => {
      const { id } = request.params as { id: string };
      const unsubscribe = options.repository.subscribe?.(id, (message) => {
        if (socket.readyState === socket.OPEN)
          socket.send(
            JSON.stringify({ type: "message.created", data: message }),
          );
      });
      if (!unsubscribe) {
        socket.close(1013, "Tempo real indisponível; use polling");
        return;
      }
      socket.on("close", unsubscribe);
      socket.on("error", unsubscribe);
    },
  );
  chat.get(
    "/v1/chat/conversations",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["chat"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        querystring: z.object({ cursor: cursorSchema }),
        response: {
          200: z.object({
            data: z.array(
              z.object({
                id: z.string().uuid(),
                marketId: z.string().uuid(),
                contextType: z.enum([
                  "LISTING",
                  "REQUEST",
                  "PROPOSAL",
                  "ORDER",
                ]),
                contextId: z.string().uuid(),
                title: z.string(),
                updatedAt: z.string().datetime(),
              }),
            ),
            page: z.object({ nextCursor: z.string().nullable() }),
          }),
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const context = options.contextFor(request);
      const query = request.query as { cursor?: string };
      const page = await options.repository.listConversations({
        marketId: context.market.id,
        userId: context.principal.sub,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      });
      return { data: page.data, page: { nextCursor: page.nextCursor } };
    },
  );
  chat.get(
    "/v1/chat/conversations/:id/messages",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["chat"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: paramsSchema,
        querystring: z.object({ cursor: cursorSchema }),
        response: {
          200: z.object({
            data: z.array(participantMessageSchema),
            page: z.object({ nextCursor: z.string().nullable() }),
          }),
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) => {
      const context = options.contextFor(request);
      const { id } = request.params as { id: string };
      const { cursor } = request.query as { cursor?: string };
      try {
        const page = await options.repository.listMessages({
          marketId: context.market.id,
          userId: context.principal.sub,
          conversationId: id,
          ...(cursor ? { cursor } : {}),
        });
        return {
          data: page.data.map((message) => ({
            ...message,
            mine: message.senderUserId === context.principal.sub,
          })),
          page: { nextCursor: page.nextCursor },
        };
      } catch (error) {
        throw mapChatError(error);
      }
    },
  );
  chat.post(
    "/v1/chat/conversations/:id/messages",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["chat"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: paramsSchema,
        body: z.object({
          clientMessageId: z.string().uuid(),
          body: z.string().trim().min(1).max(4000),
          attachments: z
            .array(
              z.object({
                storageKey: z
                  .string()
                  .regex(/^uploads\/[0-9a-f-]{36}\/[\w.-]+$/),
                mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
              }),
            )
            .max(4)
            .default([]),
        }),
        response: {
          200: participantMessageSchema,
          201: participantMessageSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const context = options.contextFor(request);
      const { id } = request.params as { id: string };
      const body = request.body as {
        clientMessageId: string;
        body: string;
        attachments: Array<{
          storageKey: string;
          mimeType: "image/jpeg" | "image/png" | "image/webp";
        }>;
      };
      const moderation = moderateText(body.body);
      if (
        body.attachments.some(
          (attachment) =>
            !attachment.storageKey.startsWith(
              `uploads/${context.principal.sub}/`,
            ),
        )
      )
        throw new ApiError(
          403,
          "CHAT_ATTACHMENT_FORBIDDEN",
          "Arquivo não pertence ao participante",
        );
      try {
        const result = await options.repository.sendMessage({
          marketId: context.market.id,
          userId: context.principal.sub,
          companyIds: context.principal.seller_ids,
          conversationId: id,
          clientMessageId: body.clientMessageId,
          safeBody: moderation.safeText,
          moderationStatus: moderation.decision,
          reasons: moderation.reasons,
          originalBody: body.body,
          attachments: body.attachments,
        });
        if (result.created)
          await options.audit.record({
            actorUserId: context.principal.sub,
            marketId: context.market.id,
            action: "CHAT_MESSAGE_SENT",
            entityType: "message",
            entityId: result.message.id,
            ip: request.ip,
            diff: {
              moderationStatus: moderation.decision,
              reasons: moderation.reasons,
            },
          });
        return reply
          .status(result.created ? 201 : 200)
          .send({ ...result.message, mine: true });
      } catch (error) {
        throw mapChatError(error);
      }
    },
  );
  chat.post(
    "/v1/chat/conversations/:id/read",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["chat"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        params: paramsSchema,
        response: { 204: z.null(), 401: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const context = options.contextFor(request);
      try {
        await options.repository.markRead({
          marketId: context.market.id,
          userId: context.principal.sub,
          conversationId: (request.params as { id: string }).id,
        });
        return reply.status(204).send(null);
      } catch (error) {
        throw mapChatError(error);
      }
    },
  );
  chat.post(
    "/v1/chat/reports",
    {
      preHandler: options.authenticate,
      schema: {
        tags: ["moderation"],
        security: [{ bearerAuth: [] }],
        headers: headersSchema,
        body: z.object({
          targetType: z.enum(["MESSAGE", "LISTING", "STORE"]),
          targetId: z.string().uuid(),
          reason: z.enum([
            "CONTACT_ATTEMPT",
            "FRAUD",
            "ABUSE",
            "MISLEADING",
            "OTHER",
          ]),
          details: z.string().max(1000).optional(),
        }),
        response: {
          200: z.object({
            id: z.string().uuid(),
            targetType: z.string(),
            targetId: z.string().uuid(),
            reason: z.string(),
            status: z.string(),
          }),
          201: z.object({
            id: z.string().uuid(),
            targetType: z.string(),
            targetId: z.string().uuid(),
            reason: z.string(),
            status: z.string(),
          }),
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const context = options.contextFor(request);
      const body = request.body as Parameters<ChatRepository["report"]>[0];
      const safeDetails = body.details
        ? moderateText(body.details).safeText
        : undefined;
      const result = await options.repository.report({
        ...body,
        ...(safeDetails ? { details: safeDetails } : {}),
        marketId: context.market.id,
        reporterUserId: context.principal.sub,
      });
      return reply.status(result.created ? 201 : 200).send(result.report);
    },
  );
}

function mapChatError(error: unknown) {
  if (error instanceof Error && error.message === "MODERATION_SANCTION_ACTIVE")
    return new ApiError(
      403,
      "MODERATION_SANCTION_ACTIVE",
      "Envio suspenso pela política de segurança",
    );
  if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND")
    return new ApiError(
      404,
      "CONVERSATION_NOT_FOUND",
      "Conversa não encontrada",
    );
  return error;
}
