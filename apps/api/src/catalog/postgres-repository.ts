import {
  importCatalog,
  parseCatalogCsv,
} from "@partsagricola/db/catalog-import";
import type pg from "pg";
import type {
  Category,
  Compatibility,
  MachineModel,
  Part,
  Reference,
  SearchResult,
  SearchSort,
} from "./contracts.ts";
import type {
  CatalogAdminEntity,
  CatalogRepository,
  CatalogSearchInput,
} from "./repository.ts";

type Cursor = { sort: SearchSort; keys: Array<string | number>; id: string };

export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly pool: pg.Pool) {}

  async listMachineTypes(): Promise<Reference[]> {
    const result = await this.pool.query(
      "select id,name,slug from marketplace.machine_type where active order by name,id",
    );
    return result.rows;
  }

  async listBrands(machineTypeId?: string): Promise<Reference[]> {
    const result = await this.pool.query(
      `select b.id,b.name,b.slug
         from marketplace.brand b
        where b.active
          and ($1::uuid is null or exists (
            select 1 from marketplace.machine_type_brand mtb
            join marketplace.machine_type mt on mt.id=mtb.machine_type_id and mt.active
             where mtb.brand_id=b.id and mtb.machine_type_id=$1 and mtb.active
          ))
        order by b.name,b.id`,
      [machineTypeId ?? null],
    );
    return result.rows;
  }

  async listModels(input: {
    brandId?: string;
    machineTypeId?: string;
  }): Promise<MachineModel[]> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      slug: string;
      year_start: number | null;
      year_end: number | null;
    }>(
      `select mm.id,mm.name,mm.slug,mm.year_start,mm.year_end
         from marketplace.machine_model mm
         join marketplace.brand b on b.id=mm.brand_id and b.active
         join marketplace.machine_type mt on mt.id=mm.machine_type_id and mt.active
        where mm.active
          and ($1::uuid is null or mm.brand_id=$1)
          and ($2::uuid is null or mm.machine_type_id=$2)
        order by mm.name,mm.id`,
      [input.brandId ?? null, input.machineTypeId ?? null],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      yearStart: row.year_start,
      yearEnd: row.year_end,
    }));
  }

  async listYears(modelId: string): Promise<number[]> {
    const result = await this.pool.query<{
      year_start: number | null;
      year_end: number | null;
    }>(
      `select mm.year_start,mm.year_end from marketplace.machine_model mm
        join marketplace.brand b on b.id=mm.brand_id and b.active
        join marketplace.machine_type mt on mt.id=mm.machine_type_id and mt.active
        where mm.id=$1 and mm.active`,
      [modelId],
    );
    const row = result.rows[0];
    if (!row?.year_start || !row.year_end) return [];
    return Array.from(
      { length: row.year_end - row.year_start + 1 },
      (_, index) => row.year_start! + index,
    );
  }

  async listCategories(): Promise<Category[]> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      slug: string;
      parent_id: string | null;
    }>(
      "select id,name,slug,parent_id from marketplace.part_category where active order by name,id",
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parent_id,
    }));
  }

  async listCompatibilities(partId: string): Promise<Compatibility[]> {
    const result = await this.pool.query(
      `select pf.id,mm.id as "modelId",mt.name as "machineType",b.name as brand,
              mm.name as model,pf.year_start as "yearStart",pf.year_end as "yearEnd"
         from marketplace.part_fitment pf
         join marketplace.part p on p.id=pf.part_id and p.active
         left join marketplace.brand pb on pb.id=p.brand_id and pb.active
         left join marketplace.part_category pc on pc.id=p.category_id and pc.active
         join marketplace.machine_model mm on mm.id=pf.machine_model_id and mm.active
         join marketplace.machine_type mt on mt.id=mm.machine_type_id and mt.active
         join marketplace.brand b on b.id=mm.brand_id and b.active
        where pf.part_id=$1 and pf.active
          and (p.brand_id is null or pb.id is not null)
          and (p.category_id is null or pc.id is not null)
        order by mt.name,b.name,mm.name,pf.year_start,pf.id`,
      [partId],
    );
    return result.rows;
  }

  async findPartsByCode(input: { code: string }): Promise<Part[]> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      brand: Reference | null;
      category: Reference | null;
      codes: Part["codes"];
    }>(
      `select p.id,p.name,p.slug,p.description,
              case when b.id is null then null else jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug) end as brand,
              case when c.id is null then null else jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug) end as category,
              coalesce((select jsonb_agg(jsonb_build_object('code',pc2.code,'kind',pc2.kind) order by pc2.kind,pc2.code)
                          from marketplace.part_code pc2 where pc2.part_id=p.id and pc2.active),'[]'::jsonb) as codes
         from marketplace.part p
         join marketplace.part_code pc on pc.part_id=p.id and pc.active
         left join marketplace.brand b on b.id=p.brand_id and b.active
         left join marketplace.part_category c on c.id=p.category_id and c.active
        where p.active and pc.normalized_code=marketplace.normalize_code($1)
          and (p.brand_id is null or b.id is not null)
          and (p.category_id is null or c.id is not null)
        order by p.name,p.id`,
      [input.code],
    );
    return Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        compatibilities: await this.listCompatibilities(row.id),
      })),
    );
  }

  async listAdmin(
    entity: CatalogAdminEntity,
  ): Promise<Array<Record<string, unknown>>> {
    const queries: Record<CatalogAdminEntity, string> = {
      "machine-types":
        "select id,name,slug,active from marketplace.machine_type order by name,id",
      brands:
        'select id,name,slug,logo_url as "logoUrl",active from marketplace.brand order by name,id',
      "brand-associations": `select mtb.id,mtb.machine_type_id as "machineTypeId",mt.name as "machineTypeName",
          mtb.brand_id as "brandId",b.name as "brandName",mtb.active
        from marketplace.machine_type_brand mtb
        join marketplace.machine_type mt on mt.id=mtb.machine_type_id
        join marketplace.brand b on b.id=mtb.brand_id order by mt.name,b.name,mtb.id`,
      models: `select id,machine_type_id as "machineTypeId",brand_id as "brandId",name,slug,
          year_start as "yearStart",year_end as "yearEnd",active
        from marketplace.machine_model order by name,id`,
      categories: `select id,parent_id as "parentId",name,slug,active
        from marketplace.part_category order by name,id`,
      parts: `select id,category_id as "categoryId",brand_id as "brandId",name,slug,
          description,specifications,active from marketplace.part order by name,id`,
      codes: `select id,part_id as "partId",code,kind,source,active
        from marketplace.part_code order by code,id`,
      compatibilities: `select id,part_id as "partId",machine_model_id as "modelId",
          year_start as "yearStart",year_end as "yearEnd",notes,active
        from marketplace.part_fitment order by created_at desc,id`,
      "exchange-rates": `select id,btrim(base_currency) as "baseCurrency",
          btrim(quote_currency) as "quoteCurrency",rate::text,effective_at as "effectiveAt",active
        from marketplace.exchange_rate order by effective_at desc,id`,
    };
    return (await this.pool.query(queries[entity])).rows;
  }

  async createAdmin(
    entity: CatalogAdminEntity,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (entity) {
      case "machine-types":
        return first(
          await this.pool.query(
            `insert into marketplace.machine_type(name,slug,active) values ($1,$2,$3)
           returning id,name,slug,active`,
            [input.name, input.slug, input.active ?? true],
          ),
        );
      case "brands":
        return first(
          await this.pool.query(
            `insert into marketplace.brand(name,slug,logo_url,active) values ($1,$2,$3,$4)
           returning id,name,slug,logo_url as "logoUrl",active`,
            [
              input.name,
              input.slug,
              input.logoUrl ?? null,
              input.active ?? true,
            ],
          ),
        );
      case "brand-associations":
        return first(
          await this.pool.query(
            `insert into marketplace.machine_type_brand(machine_type_id,brand_id,active)
           values ($1,$2,$3) returning id,machine_type_id as "machineTypeId",brand_id as "brandId",active`,
            [input.machineTypeId, input.brandId, input.active ?? true],
          ),
        );
      case "models":
        return first(
          await this.pool.query(
            `insert into marketplace.machine_model(machine_type_id,brand_id,name,slug,year_start,year_end,active)
           values ($1,$2,$3,$4,$5,$6,$7)
           returning id,machine_type_id as "machineTypeId",brand_id as "brandId",name,slug,
             year_start as "yearStart",year_end as "yearEnd",active`,
            [
              input.machineTypeId,
              input.brandId,
              input.name,
              input.slug,
              input.yearStart ?? null,
              input.yearEnd ?? null,
              input.active ?? true,
            ],
          ),
        );
      case "categories":
        return first(
          await this.pool.query(
            `insert into marketplace.part_category(parent_id,name,slug,active) values ($1,$2,$3,$4)
           returning id,parent_id as "parentId",name,slug,active`,
            [
              input.parentId ?? null,
              input.name,
              input.slug,
              input.active ?? true,
            ],
          ),
        );
      case "parts":
        return first(
          await this.pool.query(
            `insert into marketplace.part(category_id,brand_id,name,slug,description,specifications,active)
           values ($1,$2,$3,$4,$5,$6,$7)
           returning id,category_id as "categoryId",brand_id as "brandId",name,slug,description,specifications,active`,
            [
              input.categoryId ?? null,
              input.brandId ?? null,
              input.name,
              input.slug,
              input.description ?? null,
              input.specifications ?? {},
              input.active ?? true,
            ],
          ),
        );
      case "codes":
        return first(
          await this.pool.query(
            `insert into marketplace.part_code(part_id,code,kind,source,active) values ($1,$2,$3,$4,$5)
           returning id,part_id as "partId",code,kind,source,active`,
            [
              input.partId,
              input.code,
              input.kind,
              input.source ?? null,
              input.active ?? true,
            ],
          ),
        );
      case "compatibilities":
        return first(
          await this.pool.query(
            `insert into marketplace.part_fitment(part_id,machine_model_id,year_start,year_end,notes,active)
           values ($1,$2,$3,$4,$5,$6)
           returning id,part_id as "partId",machine_model_id as "modelId",year_start as "yearStart",year_end as "yearEnd",notes,active`,
            [
              input.partId,
              input.modelId,
              input.yearStart ?? null,
              input.yearEnd ?? null,
              input.notes ?? null,
              input.active ?? true,
            ],
          ),
        );
      case "exchange-rates":
        return first(
          await this.pool.query(
            `insert into marketplace.exchange_rate(base_currency,quote_currency,rate,effective_at,active)
           values (upper($1),upper($2),$3,$4,true)
           returning id,btrim(base_currency) as "baseCurrency",btrim(quote_currency) as "quoteCurrency",rate::text,effective_at as "effectiveAt",active`,
            [
              input.baseCurrency,
              input.quoteCurrency,
              input.rate,
              input.effectiveAt,
            ],
          ),
        );
    }
  }

  async updateAdmin(
    entity: CatalogAdminEntity,
    id: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = adminUpdateConfig[entity];
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const [field, value] of Object.entries(input)) {
      const column = config.columns[field];
      if (!column) continue;
      values.push(value);
      assignments.push(`${column}=$${values.length}`);
    }
    if (assignments.length === 0)
      throw Object.assign(new Error("EMPTY_UPDATE"), { code: "23514" });
    values.push(id);
    const result = await this.pool.query(
      `update marketplace.${config.table} set ${assignments.join(",")}${config.updatedAt ? ",updated_at=now()" : ""}
        where id=$${values.length} returning *`,
      values,
    );
    return requireRow(result);
  }

  async deactivateAdmin(
    entity: CatalogAdminEntity,
    id: string,
  ): Promise<Record<string, unknown>> {
    const config = adminUpdateConfig[entity];
    const result = await this.pool.query(
      `update marketplace.${config.table} set active=false${config.updatedAt ? ",updated_at=now()" : ""}
        where id=$1 returning id,active`,
      [id],
    );
    return requireRow(result);
  }

  async importCatalogCsv(csv: string) {
    return importCatalog(this.pool, parseCatalogCsv(csv));
  }

  async search(input: CatalogSearchInput): Promise<{
    data: SearchResult[];
    nextCursor: string | null;
  }> {
    const values: unknown[] = [input.marketId, input.displayCurrency ?? null];
    const parameter = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    const where = [
      "c.market_id=$1",
      "c.status='APPROVED'",
      "l.status='PUBLISHED'",
      "(p.id is null or (p.active and (p.brand_id is null or part_brand.active) and (p.category_id is null or part_category.active)))",
      "(direct_model.id is null or (direct_model.active and direct_brand.active and direct_type.active))",
    ];
    if (input.query) {
      const slot = parameter(input.query);
      where.push(
        `(marketplace.normalize_search(${slot}) <% l.search_text or l.search_text % marketplace.normalize_search(${slot}))`,
      );
    }
    if (input.machineTypeId) {
      const slot = parameter(input.machineTypeId);
      where.push(`(direct_model.machine_type_id=${slot} or exists (
        select 1 from marketplace.part_fitment f
        join marketplace.machine_model fm on fm.id=f.machine_model_id and fm.active
        join marketplace.brand fb on fb.id=fm.brand_id and fb.active
        join marketplace.machine_type fmt on fmt.id=fm.machine_type_id and fmt.active
        where f.part_id=p.id and f.active and fm.machine_type_id=${slot}))`);
    }
    if (input.brandId) {
      const slot = parameter(input.brandId);
      where.push(`(direct_model.brand_id=${slot} or p.brand_id=${slot} or exists (
        select 1 from marketplace.part_fitment f
        join marketplace.machine_model fm on fm.id=f.machine_model_id and fm.active
        join marketplace.brand fb on fb.id=fm.brand_id and fb.active
        join marketplace.machine_type fmt on fmt.id=fm.machine_type_id and fmt.active
        where f.part_id=p.id and f.active and fm.brand_id=${slot}))`);
    }
    if (input.modelId) {
      const slot = parameter(input.modelId);
      where.push(`(direct_model.id=${slot} or exists (
        select 1 from marketplace.part_fitment f
        join marketplace.machine_model fm on fm.id=f.machine_model_id and fm.active
        join marketplace.brand fb on fb.id=fm.brand_id and fb.active
        join marketplace.machine_type fmt on fmt.id=fm.machine_type_id and fmt.active
        where f.part_id=p.id and f.active and f.machine_model_id=${slot}))`);
    }
    if (input.year) {
      const slot = parameter(input.year);
      where.push(`(
        (direct_model.id is not null and ${slot} between coalesce(direct_model.year_start,${slot}) and coalesce(direct_model.year_end,${slot}))
        or exists (select 1 from marketplace.part_fitment f
          join marketplace.machine_model fm on fm.id=f.machine_model_id and fm.active
          join marketplace.brand fb on fb.id=fm.brand_id and fb.active
          join marketplace.machine_type fmt on fmt.id=fm.machine_type_id and fmt.active
          where f.part_id=p.id and f.active
          and ${slot} between coalesce(f.year_start,${slot}) and coalesce(f.year_end,${slot}))
      )`);
    }
    if (input.categoryId)
      where.push(`p.category_id=${parameter(input.categoryId)}`);
    if (input.condition)
      where.push(`l.condition=${parameter(input.condition)}`);
    if (input.stateCode)
      where.push(`l.state_code=${parameter(input.stateCode)}`);
    if (input.city)
      where.push(
        `marketplace.normalize_search(l.city)=marketplace.normalize_search(${parameter(input.city)})`,
      );
    if (input.hasWarranty !== undefined)
      where.push(
        input.hasWarranty
          ? "l.warranty_months>0"
          : "coalesce(l.warranty_months,0)=0",
      );

    const needsDisplayPrice =
      input.priceMin !== undefined ||
      input.priceMax !== undefined ||
      input.sort === "PRICE_ASC";
    if (needsDisplayPrice) where.push("priced.display_amount is not null");
    if (input.priceMin !== undefined)
      where.push(`priced.display_amount>=${parameter(input.priceMin)}`);
    if (input.priceMax !== undefined)
      where.push(`priced.display_amount<=${parameter(input.priceMax)}`);

    const querySlot = parameter(input.query ?? "");
    const limitSlot = parameter(input.limit + 1);
    const cursor = input.cursor ? decodeCursor(input.cursor, input.sort) : null;
    if (cursor) {
      if (input.sort === "PRICE_ASC") {
        const amount = parameter(cursor.keys[0]);
        const id = parameter(cursor.id);
        where.push(
          `(priced.display_amount,l.id)>(${amount}::bigint,${id}::uuid)`,
        );
      } else if (input.sort === "NEWEST") {
        const date = parameter(cursor.keys[0]);
        const id = parameter(cursor.id);
        where.push(`(l.published_at,l.id)<(${date}::timestamptz,${id}::uuid)`);
      } else if (input.sort === "RATING") {
        const average = parameter(cursor.keys[0]);
        const count = parameter(cursor.keys[1]);
        const id = parameter(cursor.id);
        where.push(
          `(l.rating_average,l.rating_count,l.id)<(${average}::numeric,${count}::integer,${id}::uuid)`,
        );
      } else {
        const relevance = parameter(cursor.keys[0]);
        const id = parameter(cursor.id);
        where.push(`(scored.relevance,l.id)<(${relevance}::real,${id}::uuid)`);
      }
    }
    const order =
      input.sort === "PRICE_ASC"
        ? "priced.display_amount asc,l.id asc"
        : input.sort === "NEWEST"
          ? "l.published_at desc,l.id desc"
          : input.sort === "RATING"
            ? "l.rating_average desc,l.rating_count desc,l.id desc"
            : "scored.relevance desc,l.id desc";

    const result = await this.pool.query<SearchRow>(
      `select l.id,l.listing_type,l.title,l.condition,l.warranty_months,l.state_code,l.city,
              l.published_at,l.rating_average::float8 as rating_average,l.rating_count,
              c.id as company_id,c.trade_name,
              image.url as image_url,
              p.id as part_id,p.name as part_name,
              direct_model.id as machine_id,direct_model.name as machine_name,
              direct_brand.name as machine_brand,direct_type.name as machine_type,
              codes.values as codes,fitments.values as compatibilities,
              l.price_on_request,l.price_amount_minor,l.price_currency,
              priced.display_amount,priced.display_currency,priced.rate_effective_at,
              scored.relevance
         from marketplace.listing l
         join marketplace.company c on c.id=l.company_id
         join marketplace.market market on market.id=c.market_id
         left join marketplace.part p on p.id=l.part_id
         left join marketplace.brand part_brand on part_brand.id=p.brand_id
         left join marketplace.part_category part_category on part_category.id=p.category_id
         left join marketplace.machine_model direct_model on direct_model.id=l.machine_model_id
         left join marketplace.brand direct_brand on direct_brand.id=direct_model.brand_id
         left join marketplace.machine_type direct_type on direct_type.id=direct_model.machine_type_id
         left join lateral (
           select url from marketplace.listing_image li where li.listing_id=l.id order by position limit 1
         ) image on true
         left join lateral (
           select coalesce(array_agg(pc.code order by pc.kind,pc.code),'{}'::text[]) as values
             from marketplace.part_code pc where pc.part_id=p.id and pc.active
         ) codes on true
         left join lateral (
           select coalesce(array_agg(concat_ws(' ',mt.name,b.name,mm.name,
                    case when f.year_start is null then null else f.year_start::text end,
                    case when f.year_end is null then null else '–' || f.year_end::text end)
                    order by mt.name,b.name,mm.name),'{}'::text[]) as values
             from marketplace.part_fitment f
             join marketplace.machine_model mm on mm.id=f.machine_model_id and mm.active
             join marketplace.brand b on b.id=mm.brand_id and b.active
             join marketplace.machine_type mt on mt.id=mm.machine_type_id and mt.active
            where f.part_id=p.id and f.active
         ) fitments on true
         left join lateral (
           select er.rate,er.effective_at
             from marketplace.exchange_rate er
            where er.base_currency=l.price_currency and er.active
              and er.quote_currency=coalesce($2::char(3),market.default_currency)
              and er.effective_at<=now()
            order by er.effective_at desc limit 1
         ) rate on true
         cross join lateral (
           select coalesce($2::char(3),market.default_currency) as display_currency,
             case
               when l.price_on_request then null
               when l.price_currency=coalesce($2::char(3),market.default_currency) then l.price_amount_minor
               when rate.rate is not null then round(l.price_amount_minor*rate.rate)::bigint
               else null
             end as display_amount,
             rate.effective_at as rate_effective_at
         ) priced
         cross join lateral (
           select case when ${querySlot}='' then 0::real
             else greatest(
               similarity(marketplace.normalize_search(${querySlot}),l.search_text),
               word_similarity(marketplace.normalize_search(${querySlot}),l.search_text)
             )::real end as relevance
         ) scored
        where ${where.join(" and ")}
        order by ${order}
        limit ${limitSlot}`,
      values,
    );
    const hasNext = result.rows.length > input.limit;
    const rows = result.rows.slice(0, input.limit);
    const data = rows.map(mapSearchRow);
    const last = rows.at(-1);
    return {
      data,
      nextCursor:
        hasNext && last ? encodeCursor(cursorFor(last, input.sort)) : null,
    };
  }
}

const adminUpdateConfig: Record<
  CatalogAdminEntity,
  { table: string; updatedAt: boolean; columns: Record<string, string> }
> = {
  "machine-types": {
    table: "machine_type",
    updatedAt: false,
    columns: { name: "name", slug: "slug", active: "active" },
  },
  brands: {
    table: "brand",
    updatedAt: true,
    columns: {
      name: "name",
      slug: "slug",
      logoUrl: "logo_url",
      active: "active",
    },
  },
  "brand-associations": {
    table: "machine_type_brand",
    updatedAt: true,
    columns: {
      machineTypeId: "machine_type_id",
      brandId: "brand_id",
      active: "active",
    },
  },
  models: {
    table: "machine_model",
    updatedAt: true,
    columns: {
      machineTypeId: "machine_type_id",
      brandId: "brand_id",
      name: "name",
      slug: "slug",
      yearStart: "year_start",
      yearEnd: "year_end",
      active: "active",
    },
  },
  categories: {
    table: "part_category",
    updatedAt: false,
    columns: {
      parentId: "parent_id",
      name: "name",
      slug: "slug",
      active: "active",
    },
  },
  parts: {
    table: "part",
    updatedAt: true,
    columns: {
      categoryId: "category_id",
      brandId: "brand_id",
      name: "name",
      slug: "slug",
      description: "description",
      specifications: "specifications",
      active: "active",
    },
  },
  codes: {
    table: "part_code",
    updatedAt: false,
    columns: {
      partId: "part_id",
      code: "code",
      kind: "kind",
      source: "source",
      active: "active",
    },
  },
  compatibilities: {
    table: "part_fitment",
    updatedAt: false,
    columns: {
      partId: "part_id",
      modelId: "machine_model_id",
      yearStart: "year_start",
      yearEnd: "year_end",
      notes: "notes",
      active: "active",
    },
  },
  "exchange-rates": {
    table: "exchange_rate",
    updatedAt: false,
    columns: {
      baseCurrency: "base_currency",
      quoteCurrency: "quote_currency",
      rate: "rate",
      effectiveAt: "effective_at",
      active: "active",
    },
  },
};

function first(result: pg.QueryResult): Record<string, unknown> {
  return requireRow(result);
}

function requireRow(result: pg.QueryResult): Record<string, unknown> {
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row)
    throw Object.assign(new Error("CATALOG_NOT_FOUND"), { code: "23503" });
  return row;
}

type SearchRow = {
  id: string;
  listing_type: "PART" | "MACHINE";
  title: string;
  condition: SearchResult["condition"];
  warranty_months: number | null;
  state_code: string;
  city: string;
  published_at: Date;
  rating_average: number;
  rating_count: number;
  company_id: string;
  trade_name: string;
  image_url: string | null;
  part_id: string | null;
  part_name: string | null;
  machine_id: string | null;
  machine_name: string | null;
  machine_brand: string | null;
  machine_type: string | null;
  codes: string[];
  compatibilities: string[];
  price_on_request: boolean;
  price_amount_minor: string | null;
  price_currency: string | null;
  display_amount: string | null;
  display_currency: string;
  rate_effective_at: Date | null;
  relevance: number;
};

function mapSearchRow(row: SearchRow): SearchResult {
  const original =
    row.price_amount_minor !== null && row.price_currency
      ? {
          amountMinor: Number(row.price_amount_minor),
          currency: row.price_currency.trim(),
        }
      : null;
  const display =
    row.display_amount !== null
      ? {
          amountMinor: Number(row.display_amount),
          currency: row.display_currency.trim(),
        }
      : null;
  return {
    id: row.id,
    listingType: row.listing_type,
    title: row.title,
    condition: row.condition,
    warrantyMonths: row.warranty_months,
    stateCode: row.state_code.trim(),
    city: row.city,
    publishedAt: row.published_at.toISOString(),
    image: row.image_url,
    company: { id: row.company_id, name: row.trade_name, verified: true },
    part: row.part_id
      ? { id: row.part_id, name: row.part_name!, codes: row.codes }
      : null,
    machine: row.machine_id
      ? {
          id: row.machine_id,
          type: row.machine_type!,
          brand: row.machine_brand!,
          model: row.machine_name!,
        }
      : null,
    compatibilities: row.compatibilities,
    rating: { average: row.rating_average, count: row.rating_count },
    price: {
      onRequest: row.price_on_request,
      original,
      display,
      approximate: Boolean(
        original && display && original.currency !== display.currency,
      ),
      rateEffectiveAt: row.rate_effective_at?.toISOString() ?? null,
    },
  };
}

function cursorFor(row: SearchRow, sort: SearchSort): Cursor {
  const keys =
    sort === "PRICE_ASC"
      ? [Number(row.display_amount)]
      : sort === "NEWEST"
        ? [row.published_at.toISOString()]
        : sort === "RATING"
          ? [row.rating_average, row.rating_count]
          : [row.relevance];
  return { sort, keys, id: row.id };
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string, sort: SearchSort): Cursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Cursor;
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const validKeys =
      sort === "NEWEST"
        ? parsed.keys?.length === 1 &&
          typeof parsed.keys[0] === "string" &&
          Number.isFinite(Date.parse(parsed.keys[0]))
        : sort === "RATING"
          ? parsed.keys?.length === 2 &&
            parsed.keys.every(
              (key) => typeof key === "number" && Number.isFinite(key),
            )
          : parsed.keys?.length === 1 &&
            typeof parsed.keys[0] === "number" &&
            Number.isFinite(parsed.keys[0]);
    if (parsed.sort !== sort || !validKeys || !uuid.test(parsed.id))
      throw new Error();
    return parsed;
  } catch {
    throw Object.assign(new Error("INVALID_CATALOG_CURSOR"), {
      code: "INVALID_CATALOG_CURSOR",
    });
  }
}
