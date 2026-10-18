# AVL-171 Catalog and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete searchable machine/part catalog, audited administration, CSV import, approximate currency display and the AVL-171 performance/visual evidence.

**Architecture:** PostgreSQL 16 owns normalized full-text/trigram search and filtering. Fastify exposes public read routes and role-protected administration through an injectable catalog repository. Next.js admin proxies its HttpOnly session to those routes and renders the responsive operational UI from the shared design system.

**Tech Stack:** PostgreSQL 16, node-postgres, Fastify 5, Zod, Next.js 15, React 19, Playwright, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-18-avl-171-catalogo-busca-design.md`

## Global Constraints

- The platform advertises third-party companies; do not add cart, checkout, own inventory or platform sale behavior.
- Public reads are market-isolated; writes require `ADMIN` or `SUPPORT` and emit audit records.
- Prices remain integer minor units; conversions use PostgreSQL `numeric` and are explicitly approximate.
- PostgreSQL search p95 must remain below 300 ms with 100,000 published seeded listings.
- The entire module receives one commit and one push only after tests and screenshots pass.
- Do not deploy, merge, or publish an n8n workflow.

## Review Focus

- Ambiguous codes shared by multiple parts return a list without arbitrary selection — covered in Task 2 integration tests.
- Missing exchange rate never invents a converted amount and excludes results from converted price filters — covered in Task 2 integration tests.
- Inactive references, unapproved companies and non-published listings never leak publicly — covered in Task 2 integration tests.
- CSV validation failure rolls back every row and audit is written only after success — covered in Task 3 tests.
- All sort modes paginate deterministically across equal values — covered in Task 2 repository tests.

---

### Task 1: Catalog search schema and deterministic fixtures

**Files:**

- Create: `packages/db/sql/005_catalog_search.sql`
- Create: `packages/db/src/catalog-search.test.ts`
- Create: `packages/db/src/catalog-performance.test.ts`
- Modify: `packages/db/sql/seed_marketplace.sql`
- Modify: `packages/db/src/catalog-import.ts`
- Modify: `packages/db/src/catalog-import.test.ts`
- Modify: `docs/BANCO-MARKETPLACE.md`

**Interfaces:**

- Produces tables/functions/indexes consumed by `PostgresCatalogRepository` in Task 2.
- Preserves `parseCatalogCsv(input)` and `importCatalog(pool, rows)` for Task 3.

- [ ] Write integration tests for normalized search, equivalent codes, active references, market/status isolation, warranty constraints, exchange rates and deterministic 100k seed.
- [ ] Run the new tests and confirm they fail because migration 005 is absent.
- [ ] Add migration 005 with normalization, brand/type association, soft-delete columns, warranty/rating, exchange rates, search vector refresh and filter/search indexes.
- [ ] Update operational seeds and CSV import to maintain associations, active state and search refresh semantics.
- [ ] Run database tests with disposable PostgreSQL and confirm catalog behavior passes.
- [ ] Add the warmed ten-run p95 benchmark and confirm it stays below 300 ms on PostgreSQL 16.

### Task 2: Public catalog repository and API

**Files:**

- Create: `apps/api/src/catalog/contracts.ts`
- Create: `apps/api/src/catalog/repository.ts`
- Create: `apps/api/src/catalog/postgres-repository.ts`
- Create: `apps/api/src/catalog/routes.ts`
- Create: `apps/api/src/catalog/routes.test.ts`
- Create: `apps/api/src/catalog/postgres-repository.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/modules/index.ts`
- Modify: `apps/api/src/app.test.ts`

**Interfaces:**

- Consumes migration 005 objects from Task 1.
- Produces `CatalogRepository`, public schemas and route responses consumed by Task 3 and generated client in Task 4.

- [ ] Write route tests for all reference endpoints, code lookup, guided machine lookup, validation, filters, four sorts, stable cursors and market resolution without authentication.
- [ ] Run route tests and confirm they fail because catalog routes/repository do not exist.
- [ ] Implement typed contracts and an injectable route plugin, removing only the generic `/v1/catalog` placeholder.
- [ ] Write PostgreSQL integration tests for the acceptance query, filters, pagination, price conversion and protected visibility.
- [ ] Implement parameterized PostgreSQL queries, conversion metadata and stable keyset cursors.
- [ ] Wire the production repository and rerun API/database tests.

### Task 3: Audited catalog administration and CSV import

**Files:**

- Create: `apps/api/src/catalog/admin-routes.ts`
- Create: `apps/api/src/catalog/admin-routes.test.ts`
- Modify: `apps/api/src/catalog/contracts.ts`
- Modify: `apps/api/src/catalog/repository.ts`
- Modify: `apps/api/src/catalog/postgres-repository.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**

- Consumes `CatalogRepository` and CSV functions from Tasks 1–2.
- Produces `/v1/admin/catalog/*` endpoints consumed by the admin proxy in Task 5.

- [ ] Write tests proving anonymous, USER and FINANCE mutations fail; ADMIN/SUPPORT CRUD and import succeed; validation and duplicate conflicts are stable; every successful mutation is audited.
- [ ] Run tests and confirm they fail because admin routes are absent.
- [ ] Add Zod bodies and CRUD/import endpoints with soft-delete semantics and explicit error mapping.
- [ ] Extend the PostgreSQL repository and export CSV functions through `@partsagricola/db` without dynamic SQL from HTTP input.
- [ ] Run API and database integration tests.

### Task 4: OpenAPI and typed client

**Files:**

- Modify: `apps/api/openapi.json`
- Modify: `packages/api-client/src/schema.ts`
- Modify: `packages/api-client/src/index.ts`
- Modify: `packages/api-client/src/index.test.ts`

**Interfaces:**

- Consumes public/admin route schemas from Tasks 2–3.
- Produces typed catalog methods consumed by Task 5.

- [ ] Add client tests for query serialization, public calls, bearer-protected CRUD/import and stable error handling.
- [ ] Run tests and confirm new methods are absent.
- [ ] Generate OpenAPI/schema and implement small typed wrappers over the generated paths.
- [ ] Rerun generation and client tests; confirm a second generation creates no diff.

### Task 5: Responsive catalog administration

**Files:**

- Create: `apps/admin/src/app/administracao/catalogo/page.tsx`
- Create: `apps/admin/src/app/administracao/catalogo/catalog-admin.tsx`
- Create: `apps/admin/src/app/administracao/catalogo/actions.ts`
- Create: `apps/admin/src/app/administracao/catalogo/catalog-admin.css`
- Create: `tests/e2e/catalog-admin.spec.ts`
- Create: `docs/evidencias/avl-171/catalog-admin-desktop.png`
- Create: `docs/evidencias/avl-171/catalog-admin-mobile.png`
- Modify: `apps/admin/src/app/page.tsx`
- Modify: `.github/workflows/monorepo.yml`

**Interfaces:**

- Consumes typed admin API client from Task 4 and shared AVL-170 UI.
- Produces the human-operable catalog screen and visual evidence.

- [ ] Write Playwright tests for search/filter state, create/edit/deactivate dialog, CSV validation/import feedback, keyboard use and 320 px overflow.
- [ ] Run Playwright and confirm the route/UI is absent.
- [ ] Implement server-side authenticated loading/actions and a client interaction layer with accessible shared components.
- [ ] Add deterministic evidence mode for Playwright without weakening real API behavior.
- [ ] Run desktop/mobile tests and inspect both screenshots visually.
- [ ] Upload AVL-171 screenshots from CI.

### Task 6: Documentation, full verification and one publication

**Files:**

- Modify: `README.md`
- Modify: `docs/ARQUITETURA-INICIAL.md`
- Create: `docs/CATALOGO-E-BUSCA.md`
- Modify: `.env.example`

**Interfaces:**

- Documents all operational interfaces and proof from Tasks 1–5.

- [ ] Document routes, search/filter semantics, CSV contract, exchange rates, benchmark reproduction, security and local execution.
- [ ] Run migrations/seeds and the complete PostgreSQL integration/performance suite.
- [ ] Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm api:generate` diff check, Playwright desktop/mobile and `pnpm build`.
- [ ] Run an independent whole-branch review and fix all Critical/Important findings.
- [ ] Re-run every affected gate and inspect repository status/diff.
- [ ] Create the single AVL-171 commit, push once, open a PR stacked on `avl-170-design-system-compartilhado`, watch GitHub checks, and update Linear with evidence.
