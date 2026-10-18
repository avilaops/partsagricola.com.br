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
  CatalogFilters,
  ListingInput,
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

  async publicCatalog(filters: CatalogFilters) {
    const values: unknown[] = [];
    const where = ["l.status='PUBLISHED'", "c.status='APPROVED'"];
    if (filters.query) {
      values.push(`%${filters.query}%`);
      where.push(
        `(l.title ilike $${values.length} or l.description ilike $${values.length} or exists (select 1 from marketplace.part_code pc where pc.part_id=l.part_id and pc.code ilike $${values.length}))`,
      );
    }
    if (filters.categoryId) {
      values.push(filters.categoryId);
      where.push(`p.category_id=$${values.length}`);
    }
    if (filters.brandId) {
      values.push(filters.brandId);
      where.push(`p.brand_id=$${values.length}`);
    }
    if (filters.stateCode) {
      values.push(filters.stateCode.toUpperCase());
      where.push(`l.state_code=$${values.length}`);
    }
    const result = await this.pool.query(
      this.listingSelect(
        `${where.join(" and ")} order by l.published_at desc limit 60`,
      ),
      values,
    );
    return { items: result.rows };
  }

  async publicSeller(slug: string) {
    const companyResult = await this.pool.query<{
      tradeName: string;
      slug: string;
      description: string | null;
      city: string;
      stateCode: string;
      verified: boolean;
      categories: string[];
      serviceRegions: string[];
    }>(
      `select c.trade_name as "tradeName",c.slug,c.description,c.city,c.state_code as "stateCode",(c.status='APPROVED') as verified,
       coalesce((select array_agg(pc.name order by pc.name) from marketplace.company_category cc join marketplace.part_category pc on pc.id=cc.category_id where cc.company_id=c.id),'{}') as categories,
       coalesce((select array_agg(csr.state_code order by csr.state_code) from marketplace.company_service_region csr where csr.company_id=c.id),'{}') as "serviceRegions"
       from marketplace.company c where c.slug=$1 and c.status='APPROVED'`,
      [slug],
    );
    const company = companyResult.rows[0];
    if (!company)
      throw new ApiError(404, "SELLER_NOT_FOUND", "Vendedor não encontrado");
    const listings = await this.pool.query(
      this.listingSelect(
        "c.slug=$1 and l.status='PUBLISHED' order by l.published_at desc",
      ),
      [slug],
    );
    return { company, listings: listings.rows };
  }

  async sellerListings(companyId: string) {
    const result = await this.pool.query(
      this.listingSelect("l.company_id=$1 order by l.created_at desc", true),
      [companyId],
    );
    return { items: result.rows };
  }

  async createListing(
    companyId: string,
    input: ListingInput,
  ): Promise<{ id: string; status: "PENDING_REVIEW" }> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const created = await client.query<{ id: string }>(
        `insert into marketplace.listing (company_id,listing_type,part_id,title,description,condition,price_amount_minor,price_currency,price_on_request,state_code,city,status)
         values ($1,'PART',$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING_REVIEW') returning id`,
        [
          companyId,
          input.partId ?? null,
          input.title,
          input.description,
          input.condition,
          input.priceOnRequest ? null : input.priceAmountMinor,
          "BRL",
          input.priceOnRequest,
          input.stateCode,
          input.city,
        ],
      );
      const id = created.rows[0]!.id;
      for (const [index, url] of input.imageUrls.entries())
        await client.query(
          "insert into marketplace.listing_image(listing_id,url,alt_text,position) values ($1,$2,$3,$4)",
          [id, url, input.title, index + 1],
        );
      await client.query("commit");
      return { id, status: "PENDING_REVIEW" };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async createInterest(
    principal: SessionPrincipal,
    listingId: string,
    message?: string,
  ): Promise<{ id: string; status: "OPEN" }> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await this.ensureUser(client, principal);
      const result = await client.query<{ id: string }>(
        `insert into marketplace.listing_interest
          (listing_id,advertiser_company_id,buyer_user_id,correlation_id,message)
         select l.id,l.company_id,$2,$3,$4 from marketplace.listing l
         where l.id=$1 and l.status='PUBLISHED'
         returning id`,
        [listingId, principal.sub, crypto.randomUUID(), message ?? null],
      );
      if (!result.rows[0])
        throw new ApiError(404, "LISTING_NOT_FOUND", "Anúncio não encontrado");
      await client.query("commit");
      return { id: result.rows[0].id, status: "OPEN" };
    } catch (error) {
      await client.query("rollback");
      if ((error as { code?: string }).code === "23505")
        throw new ApiError(
          409,
          "INTEREST_ALREADY_EXISTS",
          "Você já demonstrou interesse neste anúncio",
        );
      throw error;
    } finally {
      client.release();
    }
  }

  async buyerInterests(userId: string) {
    const result = await this.pool.query(
      this.interestSelect("i.buyer_user_id=$1 order by i.created_at desc"),
      [userId],
    );
    return { items: result.rows };
  }

  async sellerInterests(companyId: string) {
    const result = await this.pool.query(
      this.interestSelect(
        "i.advertiser_company_id=$1 order by i.created_at desc",
      ),
      [companyId],
    );
    return { items: result.rows };
  }

  async createSellerProposal(
    principal: SessionPrincipal,
    companyId: string,
    interestId: string,
    input: { amountMinor?: number | undefined; terms: string },
  ): Promise<{ id: string; status: "SENT" }> {
    const result = await this.pool.query<{ id: string }>(
      `insert into marketplace.proposal
        (interest_id,advertiser_company_id,created_by_user_id,issuer_company_id,direction,amount_minor,currency,terms)
       select i.id,i.advertiser_company_id,$3,$2,'ADVERTISER_TO_BUYER',$4,$5,$6
       from marketplace.listing_interest i where i.id=$1 and i.advertiser_company_id=$2 and i.status='OPEN'
       returning id`,
      [
        interestId,
        companyId,
        principal.sub,
        input.amountMinor ?? null,
        input.amountMinor === undefined ? null : "BRL",
        input.terms,
      ],
    );
    if (!result.rows[0])
      throw new ApiError(404, "INTEREST_NOT_FOUND", "Interesse não encontrado");
    return { id: result.rows[0].id, status: "SENT" };
  }

  private listingSelect(where: string, includeStatus = false) {
    return `select l.id,l.title,l.description,l.condition,l.price_amount_minor::int as "priceAmountMinor",l.price_on_request as "priceOnRequest",l.state_code as "stateCode",l.city,
      (select li.url from marketplace.listing_image li where li.listing_id=l.id order by li.position limit 1) as "imageUrl",
      json_build_object('tradeName',c.trade_name,'slug',c.slug,'verified',(c.status='APPROVED')) as company${includeStatus ? ",l.status" : ""}
      from marketplace.listing l join marketplace.company c on c.id=l.company_id left join marketplace.part p on p.id=l.part_id where ${where}`;
  }

  private interestSelect(where: string) {
    return `select i.id,i.status,i.message,
      json_build_object('id',l.id,'title',l.title) as listing,
      json_build_object('name',u.name,'email',u.email) as buyer,
      case when p.id is null then null else json_build_object('id',p.id,'amountMinor',p.amount_minor::int,'terms',p.terms,'status',p.status) end as "latestProposal"
      from marketplace.listing_interest i
      join marketplace.listing l on l.id=i.listing_id
      join marketplace.app_user u on u.id=i.buyer_user_id
      left join lateral (select * from marketplace.proposal px where px.interest_id=i.id order by px.created_at desc limit 1) p on true
      where ${where}`;
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
