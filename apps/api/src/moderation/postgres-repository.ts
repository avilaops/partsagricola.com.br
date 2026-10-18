import type pg from "pg";
import {
  sanctionKind,
  type ModerationFlag,
  type ModerationPolicy,
  type ModerationRepository,
  type ModerationSanction,
} from "./repository.ts";

export class PostgresModerationRepository implements ModerationRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listFlags(input: {
    marketId: string;
    status?: ModerationFlag["status"];
  }) {
    const result = await this.pool.query<FlagRow>(
      `select id,market_id,company_id,user_id,content_type,content_id,decision,
        reasons,source,status,redacted_excerpt,created_at
       from marketplace.moderation_flag
       where market_id=$1 and ($2::text is null or status=$2)
       order by created_at,id limit 100`,
      [input.marketId, input.status ?? null],
    );
    return result.rows.map(mapFlag);
  }

  async reviewFlag(input: {
    marketId: string;
    flagId: string;
    reviewerUserId: string;
    outcome: "CONFIRMED" | "DISMISSED";
    note: string;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const selected = await client.query<FlagRow>(
        `select id,market_id,company_id,user_id,content_type,content_id,decision,
          reasons,source,status,redacted_excerpt,created_at
         from marketplace.moderation_flag where id=$1 and market_id=$2 for update`,
        [input.flagId, input.marketId],
      );
      const row = selected.rows[0];
      if (!row) throw new Error("MODERATION_FLAG_NOT_FOUND");
      if (row.status !== "OPEN")
        throw new Error("MODERATION_FLAG_ALREADY_REVIEWED");
      const status = input.outcome === "CONFIRMED" ? "RESOLVED" : "REJECTED";
      await client.query(
        `update marketplace.moderation_flag set status=$2,reviewed_by_user_id=$3,
          reviewed_at=now(),resolution_note=$4 where id=$1`,
        [input.flagId, status, input.reviewerUserId, input.note],
      );
      if (row.content_type === "IMAGE")
        await client.query(
          `update marketplace.message_attachment
             set status=$2,reviewed_at=now()
           where id=$1`,
          [
            row.content_id,
            input.outcome === "CONFIRMED" ? "REJECTED" : "APPROVED",
          ],
        );
      const flag = mapFlag({ ...row, status });
      if (input.outcome === "DISMISSED") {
        await client.query("commit");
        return { flag };
      }
      const count = await client.query<{ count: number }>(
        `select count(*)::int as count from marketplace.moderation_flag
         where market_id=$1 and status='RESOLVED'
           and created_at >= now()-interval '180 days'
           and (($2::uuid is not null and company_id=$2)
             or ($3::uuid is not null and user_id=$3))`,
        [input.marketId, row.company_id, row.user_id],
      );
      const policy = await getPolicy(client, input.marketId);
      const kind = sanctionKind(count.rows[0]!.count, policy);
      let sanction: ModerationSanction | undefined;
      if (kind) {
        const inserted = await client.query<SanctionRow>(
          `insert into marketplace.moderation_sanction
            (market_id,company_id,user_id,flag_id,kind,reason,ends_at,created_by_user_id)
           values ($1,$2,$3,$4,$5,$6,
             case when $5='SUSPENSION' then now()+($7::int*interval '1 hour') else null end,$8)
           returning id,company_id,user_id,kind,reason,starts_at,ends_at`,
          [
            input.marketId,
            row.company_id,
            row.user_id,
            input.flagId,
            kind,
            input.note,
            policy.suspensionHours,
            input.reviewerUserId,
          ],
        );
        sanction = mapSanction(inserted.rows[0]!);
      }
      await client.query("commit");
      return { flag, ...(sanction ? { sanction } : {}) };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPolicy(marketId: string) {
    return getPolicy(this.pool, marketId);
  }

  async updatePolicy(
    input: ModerationPolicy & { marketId: string; actorUserId: string },
  ) {
    const result = await this.pool.query<PolicyRow>(
      `insert into marketplace.moderation_policy
        (market_id,warning_threshold,suspend_threshold,block_threshold,suspension_hours,updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (market_id) do update set
        warning_threshold=excluded.warning_threshold,
        suspend_threshold=excluded.suspend_threshold,
        block_threshold=excluded.block_threshold,
        suspension_hours=excluded.suspension_hours,
        updated_by_user_id=excluded.updated_by_user_id,
        updated_at=now()
       returning warning_threshold,suspend_threshold,block_threshold,suspension_hours`,
      [
        input.marketId,
        input.warningThreshold,
        input.suspendThreshold,
        input.blockThreshold,
        input.suspensionHours,
        input.actorUserId,
      ],
    );
    return mapPolicy(result.rows[0]!);
  }

  async history(input: {
    marketId: string;
    companyId?: string;
    userId?: string;
  }) {
    const [flags, sanctions] = await Promise.all([
      this.pool.query<FlagRow>(
        `select id,market_id,company_id,user_id,content_type,content_id,decision,
          reasons,source,status,redacted_excerpt,created_at
         from marketplace.moderation_flag
         where market_id=$1 and (($2::uuid is not null and company_id=$2)
           or ($3::uuid is not null and user_id=$3)) order by created_at desc`,
        [input.marketId, input.companyId ?? null, input.userId ?? null],
      ),
      this.pool.query<SanctionRow>(
        `select id,company_id,user_id,kind,reason,starts_at,ends_at
         from marketplace.moderation_sanction
         where market_id=$1 and (($2::uuid is not null and company_id=$2)
           or ($3::uuid is not null and user_id=$3)) order by created_at desc`,
        [input.marketId, input.companyId ?? null, input.userId ?? null],
      ),
    ]);
    return {
      flags: flags.rows.map(mapFlag),
      sanctions: sanctions.rows.map(mapSanction),
    };
  }
}

async function getPolicy(
  executor: Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">,
  marketId: string,
): Promise<ModerationPolicy> {
  const result = await executor.query<PolicyRow>(
    `select warning_threshold,suspend_threshold,block_threshold,suspension_hours
     from marketplace.moderation_policy where market_id=$1`,
    [marketId],
  );
  return result.rows[0]
    ? mapPolicy(result.rows[0])
    : {
        warningThreshold: 1,
        suspendThreshold: 3,
        blockThreshold: 5,
        suspensionHours: 72,
      };
}

type FlagRow = {
  id: string;
  market_id: string;
  company_id: string | null;
  user_id: string | null;
  content_type: ModerationFlag["contentType"];
  content_id: string;
  decision: ModerationFlag["decision"];
  reasons: string[];
  source: ModerationFlag["source"];
  status: ModerationFlag["status"];
  redacted_excerpt: string | null;
  created_at: Date;
};
type PolicyRow = {
  warning_threshold: number;
  suspend_threshold: number;
  block_threshold: number;
  suspension_hours: number;
};
type SanctionRow = {
  id: string;
  company_id: string | null;
  user_id: string | null;
  kind: ModerationSanction["kind"];
  reason: string;
  starts_at: Date;
  ends_at: Date | null;
};
function mapFlag(row: FlagRow): ModerationFlag {
  return {
    id: row.id,
    marketId: row.market_id,
    ...(row.company_id ? { companyId: row.company_id } : {}),
    ...(row.user_id ? { userId: row.user_id } : {}),
    contentType: row.content_type,
    contentId: row.content_id,
    decision: row.decision,
    reasons: row.reasons,
    source: row.source,
    status: row.status,
    ...(row.redacted_excerpt ? { redactedExcerpt: row.redacted_excerpt } : {}),
    createdAt: row.created_at.toISOString(),
  };
}
function mapPolicy(row: PolicyRow): ModerationPolicy {
  return {
    warningThreshold: row.warning_threshold,
    suspendThreshold: row.suspend_threshold,
    blockThreshold: row.block_threshold,
    suspensionHours: row.suspension_hours,
  };
}
function mapSanction(row: SanctionRow): ModerationSanction {
  return {
    id: row.id,
    kind: row.kind,
    reason: row.reason,
    ...(row.company_id ? { companyId: row.company_id } : {}),
    ...(row.user_id ? { userId: row.user_id } : {}),
    startsAt: row.starts_at.toISOString(),
    ...(row.ends_at ? { endsAt: row.ends_at.toISOString() } : {}),
  };
}
