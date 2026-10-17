# AVL-167 Marketplace Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o schema PostgreSQL, seeds e importação do núcleo de classificados B2B da PARTSAGRICOLA, sem entidades de e-commerce.

**Architecture:** O novo domínio vive no schema `marketplace`, isolado dos schemas legados, e é aplicado por um runner transacional de migrations SQL com lock e checksum. Empresas aprovadas publicam anúncios; usuários, opcionalmente representando empresas compradoras, registram interesses, propostas e conversas. Catálogo canônico e importações são referência, nunca estoque.

**Tech Stack:** PostgreSQL 16, SQL, Node.js 22, TypeScript, `pg`, `csv-parse`, Node test runner, pnpm/Turborepo.

**Spec:** `docs/superpowers/specs/2026-10-17-avl-167-dominio-marketplace-design.md`

## Global Constraints

- Não criar carrinho, pedido, checkout, pagamento, split, repasse, frete, devolução, estoque ou integração Odoo.
- Não executar build local; build, Playwright e validação completa de empacotamento rodam no GitHub Actions.
- Não fazer commit ou push antes de todo o módulo, testes e evidências estarem concluídos.
- Novas estruturas pertencem ao schema `marketplace`; `public.app_setting` e `public.outbox_event` permanecem compatíveis.
- Valores informativos usam `bigint` em minor units e moeda ISO 4217; nunca float.
- Toda migration e seed deve ser reaplicável com segurança.

## Review Focus

- Duas empresas com IDs misturados em anúncio/interesse/proposta devem falhar por integridade referencial.
- Empresa não aprovada tentando publicar anúncio deve falhar dentro do banco.
- CSV parcialmente inválido não pode persistir nenhuma linha.
- Migration alterada depois de aplicada deve falhar por checksum, sem aplicar migrations seguintes.
- Anúncios livres devem funcionar sem peça/modelo canônico, mas vínculos presentes precisam corresponder ao tipo.

---

### Task 1: Runner transacional de migrations

**Files:**

- Create: `packages/db/src/migrations.ts`
- Create: `packages/db/src/migrations.test.ts`
- Modify: `packages/db/src/migrate.ts`
- Modify: `packages/db/package.json`

**Interfaces:**

- Produces: `discoverMigrations(directory: URL): Promise<Migration[]>`
- Produces: `applyMigrations(pool: pg.Pool, directory: URL): Promise<MigrationResult>`
- Produces: `Migration { version: string; name: string; checksum: string; sql: string }`

- [ ] **Step 1: Write failing discovery tests**

Test sorted numeric discovery, exclusion of seed files, duplicate version rejection and stable SHA-256 checksum.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @partsagricola/db exec tsx --test src/migrations.test.ts`

Expected: FAIL because `migrations.ts` does not exist.

- [ ] **Step 3: Implement discovery**

Implement the exact interfaces above using `node:fs/promises`, `node:crypto` and a strict filename pattern `NNN_name.sql`.

- [ ] **Step 4: Add failing database tests**

Prove: first application records all files; second application is a no-op; modified applied SQL fails with `MIGRATION_CHECKSUM_MISMATCH`; concurrent calls serialize; a failing migration rolls back its own changes.

- [ ] **Step 5: Implement database application**

Use one checked-out client, `pg_advisory_lock`, `public.schema_migration`, one transaction per migration and guaranteed unlock in `finally`.

- [ ] **Step 6: Replace the one-file CLI**

Make `migrate.ts` call `applyMigrations` for `packages/db/sql/` and print applied/skipped versions without exposing the connection string.

- [ ] **Step 7: Verify GREEN**

Run focused tests against the disposable PostgreSQL URL and then `pnpm --filter @partsagricola/db typecheck`.

### Task 2: Schema do marketplace e invariantes

**Files:**

- Create: `packages/db/sql/002_marketplace_domain.sql`
- Create: `packages/db/src/domain.test.ts`

**Interfaces:**

- Consumes: `applyMigrations(pool, directory)` from Task 1.
- Produces: schema `marketplace` and its documented tables, functions, triggers, constraints and indexes.

- [ ] **Step 1: Write failing schema inventory tests**

Assert the required domain tables exist under `marketplace`, forbidden e-commerce table names do not exist, and no money-like column uses `real`, `double precision` or floating `numeric` semantics.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @partsagricola/db exec tsx --test src/domain.test.ts`

Expected: FAIL because migration 002 is absent.

- [ ] **Step 3: Implement identity, company and reference catalog tables**

Create normalization functions and tables for user, company/member/document, market/currency, machine type/model, brand, category, part/code/fitment and legacy links with UUID keys and explicit constraints.

- [ ] **Step 4: Add failing company isolation tests**

Attempt cross-company listing interest, proposal and private request references; assert SQLSTATE `23503` or `23514`.

- [ ] **Step 5: Implement listings and commercial relations**

Create listing/image, favorite, part request/image, interest, proposal, conversation/participant/message, notification, audit log, setting and feature flag. Use composite keys/FKs for company isolation and XOR checks for conversation context.

- [ ] **Step 6: Add failing lifecycle tests**

Cover company `PENDING` publication, negative price, unsupported currency, invalid fitment years, mismatched PART/MACHINE canonical links, duplicate favorite/participant and sender outside conversation.

- [ ] **Step 7: Implement triggers and search indexes**

Add publication guard, message participant guard, update timestamps and indexes for text/code/category/brand/status/company/condition/location.

- [ ] **Step 8: Verify GREEN and reapply migration**

Run domain tests twice from a fresh disposable database and confirm all expected constraints and indexes.

### Task 3: Seeds idempotentes

**Files:**

- Create: `packages/db/sql/seed_marketplace.sql`
- Create: `packages/db/src/seed.test.ts`
- Modify: `packages/db/src/seed.ts`

**Interfaces:**

- Produces: `applyMarketplaceSeed(pool: pg.Pool, file?: URL): Promise<SeedSummary>`
- Produces: `SeedSummary` with deterministic counts by reference table.

- [ ] **Step 1: Write failing seed tests**

Assert Brazil/BRL, initial machine types, named brands and part categories; assert only Brazil is active and two seed runs preserve IDs and counts.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @partsagricola/db exec tsx --test src/seed.test.ts`

- [ ] **Step 3: Implement seed SQL and runner**

Use natural-key UPSERTs in one transaction. Keep `brand_name=PARTSAGRICOLA` compatibility seed in `public.app_setting`.

- [ ] **Step 4: Verify GREEN**

Run seed tests and the CLI twice against a clean disposable database.

### Task 4: Importador CSV transacional

**Files:**

- Create: `packages/db/src/catalog-import.ts`
- Create: `packages/db/src/catalog-import.test.ts`
- Create: `packages/db/src/import-catalog.ts`
- Modify: `packages/db/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces: `parseCatalogCsv(input: string): CatalogImportRow[]`
- Produces: `importCatalog(pool: pg.Pool, rows: CatalogImportRow[]): Promise<CatalogImportSummary>`
- CSV columns: `schema_version,source,external_id,part_name,part_code,code_type,brand,category,description,machine_type,machine_brand,machine_model,year_start,year_end`.

- [ ] **Step 1: Add `csv-parse` and write failing parser tests**

Cover quoted commas, UTF-8 accents, missing columns, unsupported version, invalid years, missing identity and duplicate `source + external_id` inside the file.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @partsagricola/db exec tsx --test src/catalog-import.test.ts`

- [ ] **Step 3: Implement strict parsing and validation**

Parse synchronously, normalize empty optional fields to `null`, return all row errors together and never contact the database when parsing fails.

- [ ] **Step 4: Write failing import tests**

Prove atomic rollback, idempotent reimport, update of mutable descriptive fields, stable IDs, code normalization, fitment creation and deterministic summary.

- [ ] **Step 5: Implement transactional import and CLI**

UPSERT brand/category/machine/part/code/fitment and `legacy_catalog_link` inside one transaction. The CLI accepts an explicit CSV path and never defaults to production data.

- [ ] **Step 6: Verify GREEN**

Run parser/import tests and typecheck.

### Task 5: CI, documentação e evidências

**Files:**

- Modify: `.github/workflows/monorepo.yml`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/ARQUITETURA-INICIAL.md`
- Create: `docs/BANCO-MARKETPLACE.md`
- Create: `docs/evidencias/avl-167-schema-marketplace.md`
- Modify: `docs/superpowers/plans/2026-10-17-avl-167-dominio-marketplace.md`

**Interfaces:**

- Consumes: all prior tasks.
- Produces: reproducible validation commands and human-readable evidence.

- [ ] **Step 1: Add PostgreSQL 16 service to the monorepo CI**

Expose only the CI loopback port, set `MARKETPLACE_TEST_ADMIN_URL`, wait for health and let `pnpm test` execute the disposable-database suite.

- [ ] **Step 2: Update scripts and formatting scope**

Ensure `pnpm test`, `format:check`, DB migration/seed/import scripts include every new source, test and document.

- [ ] **Step 3: Document operation and legacy boundary**

Document local port 55432, disposable test safety, migration checksum recovery, seed/import commands, CSV contract, schema ownership and why legacy catalog tables are not marketplace listings.

- [ ] **Step 4: Generate evidence from the test database**

Record migration versions/checksums, table/index counts, seed counts and the critical rejected scenarios without credentials or personal data.

- [ ] **Step 5: Run final local checks without build**

Run: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, targeted PostgreSQL suite and `git diff --check`.

- [ ] **Step 6: Commit and push only after all prior steps pass**

Create one coherent AVL-167 commit, push the branch, open/update the PR and wait for GitHub Actions including Playwright and build.

- [ ] **Step 7: Close evidence loop**

Update AVL-167 with commands, results, commit, PR and external blockers; only then mark it complete.
