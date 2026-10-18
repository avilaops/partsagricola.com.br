import { parse } from "csv-parse/sync";
import type pg from "pg";

const COLUMNS = [
  "schema_version",
  "source",
  "external_id",
  "part_name",
  "part_code",
  "code_type",
  "brand",
  "category",
  "description",
  "machine_type",
  "machine_brand",
  "machine_model",
  "year_start",
  "year_end",
] as const;

const CODE_TYPES = new Set([
  "ORIGINAL",
  "EQUIVALENT",
  "OEM",
  "GTIN",
  "SUPPLIER",
]);

export interface CatalogImportRow {
  schemaVersion: 1;
  source: string;
  externalId: string;
  partName: string;
  partCode: string;
  codeType: "ORIGINAL" | "EQUIVALENT" | "OEM" | "GTIN" | "SUPPLIER";
  brand: string | null;
  category: string | null;
  description: string | null;
  machineType: string | null;
  machineBrand: string | null;
  machineModel: string | null;
  yearStart: number | null;
  yearEnd: number | null;
}

export interface CatalogImportSummary {
  rows: number;
  parts: number;
  codes: number;
  fitments: number;
  links: number;
}

export function resolveCatalogPath(args: string[]): string {
  const path = args.find((argument) => argument !== "--");
  if (!path) throw new Error("CATALOG_CSV_PATH_REQUIRED");
  return path;
}

export function parseCatalogCsv(input: string): CatalogImportRow[] {
  const records = parse(input, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];
  const header = records.shift() ?? [];
  const duplicates = header.filter(
    (column, position) => header.indexOf(column) !== position,
  );
  if (duplicates.length > 0) {
    throw new Error(
      `CSV_DUPLICATE_COLUMNS: ${[...new Set(duplicates)].join(", ")}`,
    );
  }
  const missing = COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new Error(`CSV_MISSING_COLUMNS: ${missing.join(", ")}`);
  }
  const unknown = header.filter(
    (column) => !COLUMNS.includes(column as (typeof COLUMNS)[number]),
  );
  if (unknown.length > 0) {
    throw new Error(`CSV_UNKNOWN_COLUMNS: ${unknown.join(", ")}`);
  }

  const index = new Map(header.map((column, position) => [column, position]));
  const value = (record: string[], column: (typeof COLUMNS)[number]) =>
    (record[index.get(column)!] ?? "").trim();
  const errors: string[] = [];
  const seen = new Set<string>();
  const result: CatalogImportRow[] = [];

  for (const [offset, record] of records.entries()) {
    const line = offset + 2;
    const rowErrors: string[] = [];
    if (record.length !== header.length) {
      rowErrors.push("quantidade de colunas inválida");
    }
    const schemaVersion = Number(value(record, "schema_version"));
    const source = value(record, "source");
    const externalId = value(record, "external_id");
    const partName = value(record, "part_name");
    const partCode = value(record, "part_code");
    const codeType = value(record, "code_type").toUpperCase();
    const yearStart = parseYear(
      value(record, "year_start"),
      "year_start",
      rowErrors,
    );
    const yearEnd = parseYear(value(record, "year_end"), "year_end", rowErrors);

    if (schemaVersion !== 1) rowErrors.push("schema_version deve ser 1");
    if (!source) rowErrors.push("source é obrigatório");
    if (!externalId) rowErrors.push("external_id é obrigatório");
    if (!partName) rowErrors.push("part_name é obrigatório");
    if (!partCode) rowErrors.push("part_code é obrigatório");
    if (!CODE_TYPES.has(codeType)) rowErrors.push("code_type inválido");
    if (yearStart !== null && yearEnd !== null && yearEnd < yearStart) {
      rowErrors.push("year_end deve ser maior ou igual a year_start");
    }

    const identity = `${source}\u0000${externalId}`;
    if (source && externalId && seen.has(identity)) {
      rowErrors.push("source e external_id duplicados");
    }
    seen.add(identity);

    const machine = [
      value(record, "machine_type"),
      value(record, "machine_brand"),
      value(record, "machine_model"),
    ];
    if (machine.some(Boolean) && !machine.every(Boolean)) {
      rowErrors.push(
        "machine_type, machine_brand e machine_model devem ser informados juntos",
      );
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors.map((error) => `linha ${line}: ${error}`));
      continue;
    }

    result.push({
      schemaVersion: 1,
      source,
      externalId,
      partName,
      partCode,
      codeType: codeType as CatalogImportRow["codeType"],
      brand: optional(value(record, "brand")),
      category: optional(value(record, "category")),
      description: optional(value(record, "description")),
      machineType: optional(machine[0]!),
      machineBrand: optional(machine[1]!),
      machineModel: optional(machine[2]!),
      yearStart,
      yearEnd,
    });
  }

  if (errors.length > 0) {
    throw new Error(`CSV_INVALID\n${errors.join("\n")}`);
  }
  return result;
}

export async function importCatalog(
  pool: pg.Pool,
  rows: CatalogImportRow[],
): Promise<CatalogImportSummary> {
  const client = await pool.connect();
  const summary: CatalogImportSummary = {
    rows: rows.length,
    parts: 0,
    codes: 0,
    fitments: 0,
    links: 0,
  };

  try {
    await client.query("begin");
    const lockKeys = [
      ...new Map(
        rows.map((row) => [
          `${row.source}\u0000${row.externalId}`,
          [row.source, row.externalId] as const,
        ]),
      ).values(),
    ].sort(([leftSource, leftId], [rightSource, rightId]) =>
      `${leftSource}\u0000${leftId}`.localeCompare(
        `${rightSource}\u0000${rightId}`,
      ),
    );
    for (const [source, externalId] of lockKeys) {
      await client.query(
        "select pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [source, externalId],
      );
    }
    for (const row of rows) {
      const brandId = row.brand
        ? await upsertNamedReference(client, "brand", row.brand)
        : null;
      const categoryId = row.category
        ? await upsertNamedReference(client, "part_category", row.category)
        : null;
      const existing = await client.query<{ entity_id: string }>(
        `select entity_id from marketplace.legacy_catalog_link
          where source = $1 and external_id = $2 and entity_type = 'PART'`,
        [row.source, row.externalId],
      );
      let partId = existing.rows[0]?.entity_id;
      if (partId) {
        await client.query(
          `update marketplace.part
              set name = $2, description = $3, brand_id = $4, category_id = $5,
                  active = true, updated_at = now()
            where id = $1`,
          [partId, row.partName, row.description, brandId, categoryId],
        );
      } else {
        const created = await client.query<{ id: string }>(
          `insert into marketplace.part
             (name,slug,description,brand_id,category_id)
           values ($1,$2,$3,$4,$5) returning id`,
          [
            row.partName,
            `${slug(row.partName)}-${slug(row.source)}-${slug(row.externalId)}`,
            row.description,
            brandId,
            categoryId,
          ],
        );
        partId = created.rows[0]!.id;
      }
      summary.parts += 1;

      await client.query(
        `insert into marketplace.part_code (part_id,code,kind,source)
         values ($1,$2,$3,$4)
         on conflict (part_id,normalized_code,kind)
         do update set code = excluded.code, source = excluded.source, active = true`,
        [partId, row.partCode, row.codeType, row.source],
      );
      summary.codes += 1;

      if (row.machineType && row.machineBrand && row.machineModel) {
        const machineTypeId = await upsertNamedReference(
          client,
          "machine_type",
          row.machineType,
        );
        const machineBrandId = await upsertNamedReference(
          client,
          "brand",
          row.machineBrand,
        );
        const machine = await client.query<{ id: string }>(
          `insert into marketplace.machine_model
             (machine_type_id,brand_id,name,slug,year_start,year_end)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (brand_id,slug) do update set
             machine_type_id = excluded.machine_type_id,
             name = excluded.name,
             year_start = excluded.year_start,
             year_end = excluded.year_end,
             active = true,
             updated_at = now()
           returning id`,
          [
            machineTypeId,
            machineBrandId,
            row.machineModel,
            slug(row.machineModel),
            row.yearStart,
            row.yearEnd,
          ],
        );
        await client.query(
          `insert into marketplace.machine_type_brand
             (machine_type_id,brand_id,active)
           values ($1,$2,true)
           on conflict (machine_type_id,brand_id)
           do update set active=true,updated_at=now()`,
          [machineTypeId, machineBrandId],
        );
        await client.query(
          `update marketplace.part_fitment
              set active=true
            where part_id=$1 and machine_model_id=$2
              and year_start is not distinct from $3::smallint
              and year_end is not distinct from $4::smallint`,
          [partId, machine.rows[0]!.id, row.yearStart, row.yearEnd],
        );
        await client.query(
          `insert into marketplace.part_fitment
             (part_id,machine_model_id,year_start,year_end)
           select $1,$2,$3,$4
           where not exists (
             select 1 from marketplace.part_fitment
              where part_id = $1 and machine_model_id = $2
                and year_start is not distinct from $3::smallint
                and year_end is not distinct from $4::smallint
           )`,
          [partId, machine.rows[0]!.id, row.yearStart, row.yearEnd],
        );
        summary.fitments += 1;
      }

      await client.query(
        `insert into marketplace.legacy_catalog_link
           (source,external_id,entity_type,entity_id,source_payload,imported_at)
         values ($1,$2,'PART',$3,$4::jsonb,now())
         on conflict (source,external_id) do update set
           entity_type = excluded.entity_type,
           entity_id = excluded.entity_id,
           source_payload = excluded.source_payload,
           imported_at = now()`,
        [row.source, row.externalId, partId, JSON.stringify(row)],
      );
      summary.links += 1;
    }
    await client.query("commit");
    return summary;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

type ReferenceTable = "brand" | "part_category" | "machine_type";

async function upsertNamedReference(
  client: pg.PoolClient,
  table: ReferenceTable,
  name: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into marketplace.${table} (name,slug)
     values ($1,$2)
     on conflict (slug) do update set name = excluded.name, active = true
     returning id`,
    [name, slug(name)],
  );
  return result.rows[0]!.id;
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function optional(value: string): string | null {
  return value.length > 0 ? value : null;
}

function parseYear(
  value: string,
  field: "year_start" | "year_end",
  errors: string[],
): number | null {
  if (!value) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    errors.push(`${field} deve estar entre 1900 e 2200`);
    return null;
  }
  return year;
}
