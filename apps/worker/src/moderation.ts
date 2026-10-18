import type pg from "pg";
import type { ModerationEvidence } from "@partsagricola/providers";

export type ModerationDecision = "ALLOW" | "MASK" | "BLOCK";
export type ModerationJob = {
  id: string;
  contentType: "MESSAGE_TEXT" | "MESSAGE_IMAGE" | "LISTING_TEXT" | "STORE_TEXT";
  contentId: string;
  currentDecision: ModerationDecision;
  evidence?: ModerationEvidence;
  storageKey?: string;
};
export interface ModerationJobStore {
  claim(): Promise<ModerationJob | null>;
  complete(
    id: string,
    result: {
      decision: ModerationDecision;
      reasons: string[];
      purgeEvidence: boolean;
    },
  ): Promise<void>;
  requireReview(id: string, reason: string): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  purgeExpiredEvidence(): Promise<number>;
}
export type ModerationProviders = {
  decryptEvidence(value: ModerationEvidence): string;
  analyzeText(
    value: string,
  ): Promise<{ decision: ModerationDecision; reasons: string[] }>;
  extractImageText(storageKey: string): Promise<string | null>;
};

const rank: Record<ModerationDecision, number> = {
  ALLOW: 0,
  MASK: 1,
  BLOCK: 2,
};

export async function processNextModeration(
  store: ModerationJobStore,
  providers: ModerationProviders,
) {
  await store.purgeExpiredEvidence();
  const job = await store.claim();
  if (!job) return false;
  try {
    let text: string | null;
    if (job.contentType === "MESSAGE_IMAGE") {
      text = await providers.extractImageText(job.storageKey!);
      if (text === null) {
        await store.requireReview(job.id, "OCR_UNAVAILABLE");
        return true;
      }
    } else {
      if (!job.evidence) throw new Error("MODERATION_EVIDENCE_MISSING");
      text = providers.decryptEvidence(job.evidence);
    }
    const analyzed = await providers.analyzeText(text);
    const decision =
      rank[analyzed.decision] > rank[job.currentDecision]
        ? analyzed.decision
        : job.currentDecision;
    await store.complete(job.id, {
      decision,
      reasons: analyzed.reasons,
      purgeEvidence: Boolean(job.evidence),
    });
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "MODERATION_FAILED";
    await store.fail(job.id, message);
    throw error;
  }
}

export class PostgresModerationJobs implements ModerationJobStore {
  private readonly pool: pg.Pool;
  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async claim(): Promise<ModerationJob | null> {
    const result = await this.pool.query<{
      id: string;
      content_type: ModerationJob["contentType"];
      content_id: string;
      storage_key: string | null;
      moderation_status: ModerationDecision | null;
      ciphertext: Buffer | null;
      iv: Buffer | null;
      auth_tag: Buffer | null;
      sha256: string | null;
      key_version: number | null;
    }>(`
      with claimed as (
        update marketplace.moderation_job set
          status='PROCESSING',attempts=attempts+1,started_at=now(),updated_at=now()
        where id=(
          select id from marketplace.moderation_job
          where status in ('PENDING','FAILED') and attempts < 10 and available_at <= now()
          order by created_at for update skip locked limit 1
        )
        returning *
      )
      select claimed.id,claimed.content_type,claimed.content_id,claimed.storage_key,
        case when claimed.content_type='MESSAGE_IMAGE' then 'ALLOW'
          else message.moderation_status end as moderation_status,
        e.ciphertext,e.iv,e.auth_tag,e.sha256,e.key_version
      from claimed
      left join marketplace.message message on message.id=claimed.content_id
      left join marketplace.moderation_evidence e on e.id=claimed.evidence_id
    `);
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      contentType: row.content_type,
      contentId: row.content_id,
      currentDecision: row.moderation_status ?? "ALLOW",
      ...(row.storage_key ? { storageKey: row.storage_key } : {}),
      ...(row.ciphertext &&
      row.iv &&
      row.auth_tag &&
      row.sha256 &&
      row.key_version
        ? {
            evidence: {
              ciphertext: row.ciphertext,
              iv: row.iv,
              authTag: row.auth_tag,
              sha256: row.sha256,
              keyVersion: row.key_version,
            },
          }
        : {}),
    };
  }

  async complete(
    id: string,
    result: {
      decision: ModerationDecision;
      reasons: string[];
      purgeEvidence: boolean;
    },
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const job = await client.query<{
        market_id: string;
        content_type: ModerationJob["contentType"];
        content_id: string;
        storage_key: string | null;
        evidence_id: string | null;
        attachment_id: string | null;
        sender_user_id: string | null;
        sender_company_id: string | null;
      }>(
        `select job.market_id,job.content_type,job.content_id,job.storage_key,job.evidence_id,
           attachment.id as attachment_id,message.sender_user_id,
           (select cp.company_id from marketplace.conversation_participant cp
             where cp.conversation_id=message.conversation_id
               and cp.user_id=message.sender_user_id limit 1) as sender_company_id
         from marketplace.moderation_job job
         left join marketplace.message message on message.id=job.content_id
         left join marketplace.message_attachment attachment
           on attachment.message_id=job.content_id and attachment.storage_key=job.storage_key
         where job.id=$1 for update of job`,
        [id],
      );
      const current = job.rows[0];
      if (!current) throw new Error("MODERATION_JOB_NOT_FOUND");
      if (current.content_type === "MESSAGE_IMAGE") {
        await client.query(
          `update marketplace.message_attachment set status=$2,reviewed_at=now()
           where message_id=$1 and storage_key=$3`,
          [
            current.content_id,
            result.decision === "ALLOW" ? "APPROVED" : "REVIEW_REQUIRED",
            current.storage_key,
          ],
        );
      } else if (current.content_type === "MESSAGE_TEXT") {
        await client.query(
          `update marketplace.message set
            moderation_status=case
              when moderation_status='BLOCK' then 'BLOCK'
              when moderation_status='MASK' and $2='ALLOW' then 'MASK'
              else $2 end,
            safe_body=case when $2 in ('MASK','BLOCK')
              then '[conteúdo removido pela moderação]' else safe_body end
           where id=$1`,
          [current.content_id, result.decision],
        );
      }
      let updatedExistingFlag = false;
      if (
        result.decision !== "ALLOW" &&
        current.content_type === "MESSAGE_TEXT"
      ) {
        const updated = await client.query(
          `update marketplace.moderation_flag set
             decision=$2,reasons=$3,source='ASYNC_TEXT',updated_at=now()
           where id=(select id from marketplace.moderation_flag
             where content_type='MESSAGE' and content_id=$1
             order by created_at limit 1)`,
          [current.content_id, result.decision, JSON.stringify(result.reasons)],
        );
        updatedExistingFlag = Boolean(updated.rowCount);
      }
      if (result.decision !== "ALLOW" && !updatedExistingFlag)
        await client.query(
          `insert into marketplace.moderation_flag
            (market_id,company_id,user_id,content_type,content_id,decision,reasons,source,redacted_excerpt)
           values ($1,$2,$3,$4,$5,$6,$7,$8,'[conteúdo protegido]')`,
          [
            current.market_id,
            current.sender_company_id,
            current.sender_user_id,
            current.content_type === "MESSAGE_IMAGE" ? "IMAGE" : "MESSAGE",
            current.content_type === "MESSAGE_IMAGE"
              ? current.attachment_id
              : current.content_id,
            result.decision,
            JSON.stringify(result.reasons),
            current.content_type === "MESSAGE_IMAGE"
              ? "ASYNC_OCR"
              : "ASYNC_TEXT",
          ],
        );
      await client.query(
        `update marketplace.moderation_job set
          status='COMPLETED',completed_at=now(),error_message=null,updated_at=now()
         where id=$1`,
        [id],
      );
      if (result.purgeEvidence && current.evidence_id)
        await client.query(
          "delete from marketplace.moderation_evidence where id=$1",
          [current.evidence_id],
        );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async requireReview(id: string, reason: string) {
    await this.pool.query(
      `with changed as (
        update marketplace.moderation_job set
          status='REVIEW_REQUIRED',error_message=$2,updated_at=now()
        where id=$1 returning content_id,storage_key
       )
       update marketplace.message_attachment attachment
       set status='REVIEW_REQUIRED'
       from changed
       where attachment.message_id=changed.content_id
         and attachment.storage_key=changed.storage_key`,
      [id, reason],
    );
  }

  async fail(id: string, error: string) {
    await this.pool.query(
      `with changed as (
        update marketplace.moderation_job set
          status=case when attempts >= 5 then 'REVIEW_REQUIRED' else 'FAILED' end,
          error_message=$2,available_at=now()+interval '5 minutes',updated_at=now()
        where id=$1 returning content_id,storage_key,status
       )
       update marketplace.message_attachment attachment
          set status='REVIEW_REQUIRED'
         from changed
        where changed.status='REVIEW_REQUIRED'
          and attachment.message_id=changed.content_id
          and attachment.storage_key=changed.storage_key`,
      [id, error.slice(0, 1000)],
    );
  }

  async purgeExpiredEvidence() {
    const result = await this.pool.query<{ count: number }>(
      "select marketplace.purge_expired_moderation_evidence() as count",
    );
    return result.rows[0]?.count ?? 0;
  }
}

export function createLocalTextModerator() {
  return async (value: string) => {
    const contact =
      /(?:\b(?:whats(?:app)?|zap|telegram|instagram)\b|@|https?:\/\/|(?:\d[\s().-]*){8,})/iu.test(
        value,
      );
    return contact
      ? { decision: "MASK" as const, reasons: ["CONTACT_PATTERN"] }
      : { decision: "ALLOW" as const, reasons: [] };
  };
}

type HttpProviderConfig = { endpoint: string; apiKey: string };

export function createHttpTextModerator(
  config: HttpProviderConfig,
  fetcher: typeof fetch = fetch,
) {
  const endpoint = new URL(config.endpoint);
  return async (text: string) => {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error("MODERATION_PROVIDER_UNAVAILABLE");
    const value = (await response.json()) as {
      decision?: string;
      reasons?: unknown;
    };
    if (
      !["ALLOW", "MASK", "BLOCK"].includes(value.decision ?? "") ||
      !Array.isArray(value.reasons) ||
      !value.reasons.every((reason) => typeof reason === "string")
    )
      throw new Error("MODERATION_PROVIDER_INVALID_RESPONSE");
    return {
      decision: value.decision as ModerationDecision,
      reasons: value.reasons as string[],
    };
  };
}

export function createHttpOcrProvider(
  config: HttpProviderConfig,
  fetcher: typeof fetch = fetch,
) {
  const endpoint = new URL(config.endpoint);
  return async (storageKey: string) => {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ storageKey }),
    });
    if (!response.ok) throw new Error("OCR_PROVIDER_UNAVAILABLE");
    const value = (await response.json()) as { text?: unknown };
    if (typeof value.text !== "string")
      throw new Error("OCR_PROVIDER_INVALID_RESPONSE");
    return value.text.trim() || null;
  };
}
