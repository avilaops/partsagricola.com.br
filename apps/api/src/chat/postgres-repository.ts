import type pg from "pg";
import type {
  ChatAttachment,
  ChatConversation,
  ChatMessage,
  ModerationStatus,
  Report,
} from "./contracts.ts";
import type { ChatRepository } from "./repository.ts";
import { decodeCursor, encodeCursor } from "../pagination.ts";

type EncryptedEvidence = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  sha256: string;
  keyVersion: number;
};

export class PostgresChatRepository implements ChatRepository {
  private readonly listeners = new Map<
    string,
    Set<(message: ChatMessage) => void>
  >();
  constructor(
    private readonly pool: pg.Pool,
    private readonly security: {
      encryptEvidence(value: string): EncryptedEvidence;
      signRead?(key: string): Promise<string>;
    },
  ) {}

  async listConversations(input: {
    marketId: string;
    userId: string;
    cursor?: string;
  }) {
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const result = await this.pool.query<{
      id: string;
      market_id: string;
      context_type: ChatConversation["contextType"];
      context_id: string;
      updated_at: Date;
    }>(
      `select c.id,c.market_id,c.context_type,c.context_id,c.updated_at
       from marketplace.conversation c
       join marketplace.conversation_participant cp on cp.conversation_id=c.id
       where c.market_id=$1 and cp.user_id=$2
         and ($3::timestamptz is null or (c.updated_at,c.id) < ($3,$4::uuid))
       order by c.updated_at desc,c.id desc limit 51`,
      [
        input.marketId,
        input.userId,
        cursor?.createdAt ?? null,
        cursor?.id ?? null,
      ],
    );
    const hasNext = result.rows.length > 50;
    const rows = result.rows.slice(0, 50);
    const last = rows.at(-1);
    return {
      data: rows.map((row) => ({
        id: row.id,
        marketId: row.market_id,
        contextType: row.context_type,
        contextId: row.context_id,
        title: contextTitle(row.context_type),
        updatedAt: row.updated_at.toISOString(),
      })),
      nextCursor:
        hasNext && last
          ? encodeCursor({
              createdAt: last.updated_at.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async listMessages(input: {
    marketId: string;
    userId: string;
    conversationId: string;
    cursor?: string;
  }) {
    await this.requireParticipant(input);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const result = await this.pool.query<MessageRow>(
      `select m.id,m.conversation_id,m.sender_user_id,m.safe_body,m.moderation_status,m.created_at,
         exists(select 1 from marketplace.conversation_participant cp
           where cp.conversation_id=m.conversation_id and cp.user_id<>m.sender_user_id
             and cp.last_read_at>=m.created_at) as read_by_recipient
       from marketplace.message m where m.conversation_id=$1
         and ($2::timestamptz is null or (created_at,id) > ($2,$3::uuid))
       order by created_at,id limit 101`,
      [input.conversationId, cursor?.createdAt ?? null, cursor?.id ?? null],
    );
    const hasNext = result.rows.length > 100;
    const rows = result.rows.slice(0, 100);
    const last = rows.at(-1);
    return {
      data: await Promise.all(rows.map((row) => this.mapMessage(row))),
      nextCursor:
        hasNext && last
          ? encodeCursor({
              createdAt: last.created_at.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async sendMessage(input: {
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
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const participant = await client.query<{ company_id: string | null }>(
        `select cp.company_id from marketplace.conversation c
         join marketplace.conversation_participant cp on cp.conversation_id=c.id
         where c.id=$1 and c.market_id=$2 and cp.user_id=$3`,
        [input.conversationId, input.marketId, input.userId],
      );
      if (!participant.rows[0]) throw new Error("CONVERSATION_NOT_FOUND");
      const participantCompanyId = participant.rows[0].company_id;
      const sanctioned = await client.query(
        `select 1 from marketplace.moderation_sanction
         where market_id=$1
           and (user_id=$2 or ($3::uuid is not null and company_id=$3))
           and (kind='BLOCK' or (kind='SUSPENSION' and ends_at>now()))
         limit 1`,
        [input.marketId, input.userId, participantCompanyId],
      );
      if (sanctioned.rowCount) throw new Error("MODERATION_SANCTION_ACTIVE");
      await this.requireParticipant(input, client);
      const existing = await client.query<MessageRow>(
        `select m.id,m.conversation_id,m.sender_user_id,m.safe_body,m.moderation_status,m.created_at,
           exists(select 1 from marketplace.conversation_participant cp
             where cp.conversation_id=m.conversation_id and cp.user_id<>m.sender_user_id
               and cp.last_read_at>=m.created_at) as read_by_recipient
         from marketplace.message m
         where m.conversation_id=$1 and m.sender_user_id=$2 and m.client_message_id=$3`,
        [input.conversationId, input.userId, input.clientMessageId],
      );
      if (existing.rows[0]) {
        await client.query("commit");
        return {
          message: await this.mapMessage(existing.rows[0]),
          created: false,
        };
      }
      const encrypted = this.security.encryptEvidence(input.originalBody);
      const evidence = await client.query<{ id: string }>(
        `insert into marketplace.moderation_evidence
          (ciphertext,iv,auth_tag,key_version,sha256)
         values ($1,$2,$3,$4,$5) returning id`,
        [
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.authTag,
          encrypted.keyVersion,
          encrypted.sha256,
        ],
      );
      const inserted = await client.query<MessageRow>(
        `insert into marketplace.message
          (conversation_id,sender_user_id,body,safe_body,moderation_status,client_message_id)
         values ($1,$2,$3,$3,$4,$5)
         returning id,conversation_id,sender_user_id,safe_body,moderation_status,created_at,
           false as read_by_recipient`,
        [
          input.conversationId,
          input.userId,
          input.safeBody,
          input.moderationStatus,
          input.clientMessageId,
        ],
      );
      const message = inserted.rows[0]!;
      if (input.moderationStatus !== "ALLOW")
        await client.query(
          `insert into marketplace.moderation_flag
            (market_id,company_id,user_id,content_type,content_id,decision,reasons,source,redacted_excerpt)
           values ($1,$2,$3,'MESSAGE',$4,$5,$6,'SYNC',$7)`,
          [
            input.marketId,
            participantCompanyId,
            input.userId,
            message.id,
            input.moderationStatus,
            JSON.stringify(input.reasons),
            input.safeBody.slice(0, 240),
          ],
        );
      await client.query(
        `insert into marketplace.moderation_job
          (market_id,content_type,content_id,evidence_id)
         values ($1,'MESSAGE_TEXT',$2,$3)`,
        [input.marketId, message.id, evidence.rows[0]!.id],
      );
      for (const [index, attachment] of input.attachments.entries()) {
        await client.query(
          `insert into marketplace.message_attachment
            (message_id,storage_key,mime_type,position)
           values ($1,$2,$3,$4)`,
          [message.id, attachment.storageKey, attachment.mimeType, index + 1],
        );
        await client.query(
          `insert into marketplace.moderation_job
            (market_id,content_type,content_id,storage_key)
           values ($1,'MESSAGE_IMAGE',$2,$3)`,
          [input.marketId, message.id, attachment.storageKey],
        );
      }
      await client.query(
        "update marketplace.conversation set updated_at=now() where id=$1",
        [input.conversationId],
      );
      await client.query("commit");
      const mapped = await this.mapMessage(message);
      for (const listener of this.listeners.get(input.conversationId) ?? [])
        listener(mapped);
      return { message: mapped, created: true };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async markRead(input: {
    marketId: string;
    userId: string;
    conversationId: string;
  }) {
    await this.requireParticipant(input);
    await this.pool.query(
      `update marketplace.conversation_participant
       set last_read_at=now() where conversation_id=$1 and user_id=$2`,
      [input.conversationId, input.userId],
    );
  }

  async report(input: {
    marketId: string;
    reporterUserId: string;
    targetType: Report["targetType"];
    targetId: string;
    reason: Report["reason"];
    details?: string;
  }) {
    await this.requireReportTarget(input);
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const inserted = await client.query<ReportRow>(
        `insert into marketplace.content_report
          (market_id,reporter_user_id,target_type,target_id,reason,details)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (reporter_user_id,target_type,target_id) do nothing
         returning id,target_type,target_id,reason,status`,
        [
          input.marketId,
          input.reporterUserId,
          input.targetType,
          input.targetId,
          input.reason,
          input.details ?? null,
        ],
      );
      if (inserted.rows[0]) {
        await client.query(
          `insert into marketplace.moderation_flag
            (market_id,company_id,user_id,content_type,content_id,decision,reasons,source,redacted_excerpt)
           select $1,
             case when $2='LISTING' then (select company_id from marketplace.listing where id=$3)
                  when $2='STORE' then $3 else null end,
             case when $2='MESSAGE' then (select sender_user_id from marketplace.message where id=$3)
                  else null end,
             $2,$3,'MASK',jsonb_build_array($4::text),'REPORT',$5`,
          [
            input.marketId,
            input.targetType,
            input.targetId,
            input.reason,
            input.details?.slice(0, 240) ?? null,
          ],
        );
        await client.query("commit");
        return { report: mapReport(inserted.rows[0]), created: true };
      }
      const existing = await client.query<ReportRow>(
        `select id,target_type,target_id,reason,status
         from marketplace.content_report
         where reporter_user_id=$1 and target_type=$2 and target_id=$3`,
        [input.reporterUserId, input.targetType, input.targetId],
      );
      await client.query("commit");
      return { report: mapReport(existing.rows[0]!), created: false };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  subscribe(conversationId: string, listener: (message: ChatMessage) => void) {
    const listeners = this.listeners.get(conversationId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(conversationId, listeners);
    return () => listeners.delete(listener);
  }

  private async requireParticipant(
    input: { marketId: string; userId: string; conversationId: string },
    executor: Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query"> = this.pool,
  ) {
    const allowed = await executor.query(
      `select 1 from marketplace.conversation c
       join marketplace.conversation_participant cp on cp.conversation_id=c.id
       where c.id=$1 and c.market_id=$2 and cp.user_id=$3`,
      [input.conversationId, input.marketId, input.userId],
    );
    if (!allowed.rowCount) throw new Error("CONVERSATION_NOT_FOUND");
  }

  private async requireReportTarget(input: {
    marketId: string;
    reporterUserId: string;
    targetType: Report["targetType"];
    targetId: string;
  }) {
    let query: string;
    if (input.targetType === "MESSAGE")
      query = `select 1 from marketplace.message m
        join marketplace.conversation c on c.id=m.conversation_id
        join marketplace.conversation_participant cp on cp.conversation_id=c.id
        where m.id=$1 and c.market_id=$2 and cp.user_id=$3`;
    else if (input.targetType === "LISTING")
      query = `select 1 from marketplace.listing l join marketplace.company c on c.id=l.company_id
        where l.id=$1 and c.market_id=$2`;
    else
      query = `select 1 from marketplace.company c where c.id=$1 and c.market_id=$2`;
    const values =
      input.targetType === "MESSAGE"
        ? [input.targetId, input.marketId, input.reporterUserId]
        : [input.targetId, input.marketId];
    const result = await this.pool.query(query, values);
    if (!result.rowCount) throw new Error("REPORT_TARGET_NOT_FOUND");
  }

  private async mapMessage(row: MessageRow): Promise<ChatMessage> {
    const [attachments, flags] = await Promise.all([
      this.pool.query<{
        id: string;
        storage_key: string;
        mime_type: ChatAttachment["mimeType"];
        status: ChatAttachment["status"];
      }>(
        `select id,storage_key,mime_type,status
       from marketplace.message_attachment where message_id=$1 order by position`,
        [row.id],
      ),
      this.pool.query<{ reasons: string[] }>(
        `select reasons from marketplace.moderation_flag
       where content_type='MESSAGE' and content_id=$1
       order by created_at desc limit 1`,
        [row.id],
      ),
    ]);
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderUserId: row.sender_user_id,
      safeBody: row.safe_body,
      moderationStatus: row.moderation_status,
      reasons: flags.rows[0]?.reasons ?? [],
      attachments: await Promise.all(
        attachments.rows.map(async (item) => ({
          id: item.id,
          storageKey: item.storage_key,
          mimeType: item.mime_type,
          status: item.status,
          ...(item.status === "APPROVED" && this.security.signRead
            ? { url: await this.security.signRead(item.storage_key) }
            : {}),
        })),
      ),
      readByRecipient: row.read_by_recipient,
      createdAt: row.created_at.toISOString(),
    };
  }
}

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  safe_body: string;
  moderation_status: ModerationStatus;
  read_by_recipient: boolean;
  created_at: Date;
};
type ReportRow = {
  id: string;
  target_type: Report["targetType"];
  target_id: string;
  reason: Report["reason"];
  status: Report["status"];
};
function mapReport(row: ReportRow): Report {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    status: row.status,
  };
}
function contextTitle(type: ChatConversation["contextType"]) {
  return (
    {
      LISTING: "Conversa sobre anúncio",
      REQUEST: "Conversa sobre solicitação",
      PROPOSAL: "Conversa sobre proposta",
      ORDER: "Conversa sobre pedido",
    } as const
  )[type];
}
