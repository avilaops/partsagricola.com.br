export type ConversationContext = "LISTING" | "REQUEST" | "PROPOSAL" | "ORDER";
export type ModerationStatus = "ALLOW" | "MASK" | "BLOCK" | "PENDING_REVIEW";

export type ChatConversation = {
  id: string;
  marketId: string;
  contextType: ConversationContext;
  contextId: string;
  title: string;
  updatedAt: string;
};

export type ChatAttachment = {
  id: string;
  storageKey: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  status: "QUARANTINED" | "APPROVED" | "REJECTED" | "REVIEW_REQUIRED";
  url?: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  safeBody: string;
  moderationStatus: ModerationStatus;
  reasons: string[];
  attachments: ChatAttachment[];
  readByRecipient: boolean;
  createdAt: string;
};

export type Report = {
  id: string;
  targetType: "MESSAGE" | "LISTING" | "STORE";
  targetId: string;
  reason: "CONTACT_ATTEMPT" | "FRAUD" | "ABUSE" | "MISLEADING" | "OTHER";
  status: "OPEN" | "RESOLVED" | "DISMISSED";
};
