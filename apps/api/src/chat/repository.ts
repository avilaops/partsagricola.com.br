import type {
  ChatAttachment,
  ChatConversation,
  ChatMessage,
  ModerationStatus,
  Report,
} from "./contracts.ts";

export type ListPage<T> = { data: T[]; nextCursor: string | null };

export interface ChatRepository {
  listConversations(input: {
    marketId: string;
    userId: string;
    cursor?: string;
  }): Promise<ListPage<ChatConversation>>;
  listMessages(input: {
    marketId: string;
    userId: string;
    conversationId: string;
    cursor?: string;
  }): Promise<ListPage<ChatMessage>>;
  sendMessage(input: {
    marketId: string;
    userId: string;
    companyIds: string[];
    conversationId: string;
    clientMessageId: string;
    safeBody: string;
    moderationStatus: ModerationStatus;
    reasons: string[];
    originalBody: string;
    attachments: Array<{
      storageKey: string;
      mimeType: ChatAttachment["mimeType"];
    }>;
  }): Promise<{ message: ChatMessage; created: boolean }>;
  markRead(input: {
    marketId: string;
    userId: string;
    conversationId: string;
  }): Promise<void>;
  report(input: {
    marketId: string;
    reporterUserId: string;
    targetType: Report["targetType"];
    targetId: string;
    reason: Report["reason"];
    details?: string;
  }): Promise<{ report: Report; created: boolean }>;
  subscribe?(
    conversationId: string,
    listener: (message: ChatMessage) => void,
  ): () => void;
}

type SeedConversation = ChatConversation & { participantIds: string[] };

export class InMemoryChatRepository implements ChatRepository {
  private readonly conversations: SeedConversation[];
  private readonly messages: ChatMessage[] = [];
  private readonly reports: Array<Report & { reporterUserId: string }> = [];
  private readonly listeners = new Map<
    string,
    Set<(message: ChatMessage) => void>
  >();

  constructor(seed: { conversations?: SeedConversation[] } = {}) {
    this.conversations = seed.conversations ?? [];
  }

  async listConversations(input: { marketId: string; userId: string }) {
    return {
      data: this.conversations
        .filter(
          (item) =>
            item.marketId === input.marketId &&
            item.participantIds.includes(input.userId),
        )
        .map(({ participantIds: _participants, ...item }) => item),
      nextCursor: null,
    };
  }

  async listMessages(input: {
    marketId: string;
    userId: string;
    conversationId: string;
  }) {
    this.requireParticipant(input);
    return {
      data: this.messages.filter(
        (item) => item.conversationId === input.conversationId,
      ),
      nextCursor: null,
    };
  }

  async sendMessage(input: {
    marketId: string;
    userId: string;
    conversationId: string;
    clientMessageId: string;
    safeBody: string;
    moderationStatus: ModerationStatus;
    reasons: string[];
    attachments: Array<{
      storageKey: string;
      mimeType: ChatAttachment["mimeType"];
    }>;
  }) {
    this.requireParticipant(input);
    const existing = this.messages.find(
      (message) =>
        message.senderUserId === input.userId &&
        message.id === input.clientMessageId,
    );
    if (existing) return { message: existing, created: false };
    const message: ChatMessage = {
      id: input.clientMessageId,
      conversationId: input.conversationId,
      senderUserId: input.userId,
      safeBody: input.safeBody,
      moderationStatus: input.moderationStatus,
      reasons: input.reasons,
      attachments: input.attachments.map((attachment) => ({
        id: crypto.randomUUID(),
        ...attachment,
        status: "QUARANTINED",
      })),
      readByRecipient: false,
      createdAt: new Date().toISOString(),
    };
    this.messages.push(message);
    for (const listener of this.listeners.get(input.conversationId) ?? [])
      listener(message);
    return { message, created: true };
  }

  async markRead(input: {
    marketId: string;
    userId: string;
    conversationId: string;
  }) {
    this.requireParticipant(input);
  }

  async report(input: {
    reporterUserId: string;
    targetType: Report["targetType"];
    targetId: string;
    reason: Report["reason"];
  }) {
    const existing = this.reports.find(
      (item) =>
        item.reporterUserId === input.reporterUserId &&
        item.targetType === input.targetType &&
        item.targetId === input.targetId,
    );
    if (existing) return { report: existing, created: false };
    const report: Report & { reporterUserId: string } = {
      id: crypto.randomUUID(),
      reporterUserId: input.reporterUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      status: "OPEN",
    };
    this.reports.push(report);
    return { report, created: true };
  }

  subscribe(conversationId: string, listener: (message: ChatMessage) => void) {
    const listeners = this.listeners.get(conversationId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(conversationId, listeners);
    return () => listeners.delete(listener);
  }

  private requireParticipant(input: {
    marketId: string;
    userId: string;
    conversationId: string;
  }) {
    const conversation = this.conversations.find(
      (item) =>
        item.id === input.conversationId &&
        item.marketId === input.marketId &&
        item.participantIds.includes(input.userId),
    );
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
  }
}

export const emptyChatRepository = new InMemoryChatRepository();
