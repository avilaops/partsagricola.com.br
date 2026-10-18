import type pg from "pg";
import type {
  AuditEntry,
  AuditRepository,
  ImageJobQueue,
  Market,
} from "./app.ts";

export class PostgresAuditRepository implements AuditRepository {
  private readonly pool: pg.Pool;
  constructor(pool: pg.Pool) {
    this.pool = pool;
  }
  async record(entry: AuditEntry): Promise<void> {
    await this.pool.query(
      `insert into marketplace.audit_log
        (actor_user_id,company_id,market_id,action,entity_type,entity_id,ip_address,diff,metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'{}'::jsonb)`,
      [
        entry.actorUserId,
        entry.sellerId ?? null,
        entry.marketId,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.ip ?? null,
        entry.diff ?? {},
      ],
    );
  }
}

export class PostgresImageJobQueue implements ImageJobQueue {
  private readonly pool: pg.Pool;
  constructor(pool: pg.Pool) {
    this.pool = pool;
  }
  async enqueue(input: {
    sourceKey: string;
    sellerId: string;
    marketId: string;
  }): Promise<{ id: string }> {
    const result = await this.pool.query<{ id: string }>(
      `insert into marketplace.image_job (company_id,market_id,source_key)
       values ($1,$2,$3)
       on conflict (source_key) do update set updated_at=now()
       returning id`,
      [input.sellerId, input.marketId, input.sourceKey],
    );
    return result.rows[0]!;
  }
}

export async function loadMarkets(pool: pg.Pool): Promise<Market[]> {
  const result = await pool.query<{ id: string; code: string }>(
    "select id,code from marketplace.market where active=true order by code",
  );
  return result.rows.map((row) => ({
    id: row.id,
    code: row.code.trim(),
    domains:
      row.code.trim() === "BR"
        ? ["partsagricola.com.br"]
        : [`partsagricola.com.${row.code.trim().toLowerCase()}`],
  }));
}
