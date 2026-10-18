import type pg from "pg";
import type {
  AuditEntry,
  AuditRepository,
  ImageJobQueue,
  Market,
} from "./app.ts";
import { ApiError } from "./errors.ts";
import type {
  CompanyApplicationInput,
  MarketplaceRepository,
  PartRequestInput,
} from "./marketplace.ts";
import type { SessionPrincipal } from "@partsagricola/shared";

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

export class PostgresMarketplaceRepository implements MarketplaceRepository {
  private readonly pool: pg.Pool;
  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async createCompanyApplication(
    principal: SessionPrincipal,
    marketId: string,
    input: CompanyApplicationInput,
  ): Promise<{ id: string; status: "PENDING" }> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await this.ensureUser(client, principal);
      const baseSlug = slugify(input.tradeName);
      const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
      const created = await client.query<{ id: string }>(
        `insert into marketplace.company
          (market_id,cnpj,legal_name,trade_name,slug,email,phone,state_code,city,description,website)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         returning id`,
        [
          marketId,
          input.cnpj,
          input.legalName,
          input.tradeName,
          slug,
          input.email,
          input.phone ?? null,
          input.stateCode,
          input.city,
          input.description ?? null,
          input.website ?? null,
        ],
      );
      const companyId = created.rows[0]!.id;
      await client.query(
        `insert into marketplace.company_member(company_id,user_id,role)
         values ($1,$2,'OWNER')`,
        [companyId, principal.sub],
      );
      for (const categoryId of [...new Set(input.categoryIds)])
        await client.query(
          `insert into marketplace.company_category(company_id,category_id)
           values ($1,$2)`,
          [companyId, categoryId],
        );
      for (const stateCode of [
        ...new Set(input.serviceRegions.map((value) => value.toUpperCase())),
      ])
        await client.query(
          `insert into marketplace.company_service_region(company_id,state_code)
           values ($1,$2)`,
          [companyId, stateCode],
        );
      await client.query(
        `insert into outbox_event(id,event_type,event_key,correlation_id,payload)
         values ($1,'empresa.cadastro_solicitado',$2,$1,$3)`,
        [
          crypto.randomUUID(),
          `empresa:${companyId}:cadastro_solicitado`,
          { companyId, marketId },
        ],
      );
      await client.query("commit");
      return { id: companyId, status: "PENDING" };
    } catch (error) {
      await client.query("rollback");
      if ((error as { code?: string }).code === "23505")
        throw new ApiError(
          409,
          "COMPANY_ALREADY_EXISTS",
          "Empresa já cadastrada",
        );
      throw error;
    } finally {
      client.release();
    }
  }

  async createPartRequest(
    principal: SessionPrincipal,
    input: PartRequestInput,
  ): Promise<{ id: string; status: "OPEN" }> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await this.ensureUser(client, principal);
      const created = await client.query<{ id: string }>(
        `insert into marketplace.part_request
          (buyer_user_id,category_id,brand_id,title,description)
         values ($1,$2,$3,$4,$5)
         returning id`,
        [
          principal.sub,
          input.categoryId ?? null,
          input.brandId ?? null,
          input.title,
          input.description,
        ],
      );
      await client.query("commit");
      return { id: created.rows[0]!.id, status: "OPEN" };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async sellerDashboard(companyId: string) {
    const result = await this.pool.query<{
      id: string;
      tradeName: string;
      status: string;
      listings: number;
      publishedListings: number;
      openInterests: number;
      openRequests: number;
    }>(
      `select c.id,c.trade_name as "tradeName",c.status,
        (select count(*)::int from marketplace.listing l where l.company_id=c.id) as listings,
        (select count(*)::int from marketplace.listing l where l.company_id=c.id and l.status='PUBLISHED') as "publishedListings",
        (select count(*)::int from marketplace.listing_interest i where i.advertiser_company_id=c.id and i.status='OPEN') as "openInterests",
        (select count(*)::int from marketplace.part_request r where r.target_company_id=c.id and r.status='OPEN') as "openRequests"
       from marketplace.company c where c.id=$1`,
      [companyId],
    );
    const row = result.rows[0];
    if (!row)
      throw new ApiError(404, "COMPANY_NOT_FOUND", "Empresa não encontrada");
    return {
      company: { id: row.id, tradeName: row.tradeName, status: row.status },
      metrics: {
        listings: row.listings,
        publishedListings: row.publishedListings,
        openInterests: row.openInterests,
        openRequests: row.openRequests,
      },
    };
  }

  async referenceData() {
    const [categories, brands] = await Promise.all([
      this.pool.query<{ id: string; name: string }>(
        "select id,name from marketplace.part_category where active=true order by name",
      ),
      this.pool.query<{ id: string; name: string }>(
        "select id,name from marketplace.brand where active=true order by name",
      ),
    ]);
    return { categories: categories.rows, brands: brands.rows };
  }

  private async ensureUser(client: pg.PoolClient, principal: SessionPrincipal) {
    await client.query(
      `insert into marketplace.app_user(id,email,name)
       values ($1,$2,$3)
       on conflict (id) do update set email=excluded.email,updated_at=now()`,
      [principal.sub, principal.email, principal.email.split("@")[0]],
    );
  }
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "empresa";
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
