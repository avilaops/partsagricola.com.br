# AVL-168 Autenticação Centralizada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o provedor OIDC central da PARTSAGRICOLA com identidade local/social, SSO, PKCE, refresh rotativo, RBAC, TOTP e sessão compartilhada.

**Architecture:** O PostgreSQL é a fonte de verdade para usuários, códigos, sessões e revogações. `apps/auth` expõe protocolo e telas Fastify, enquanto `packages/shared` consome introspecção para guardas reutilizáveis; os três Next.js apenas integram esse contrato.

**Tech Stack:** Node.js 22, TypeScript, Fastify 5, PostgreSQL 16, `pg`, `argon2`, `jose`, `otplib`, `nodemailer`, React/Next.js 15, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-avl-168-autenticacao-centralizada-design.md`

## Global Constraints

- Nenhum carrinho, checkout, pagamento, estoque, Odoo, biometria ou password grant.
- Segredos sociais, Ed25519, AES e lookup HMAC somente em ambiente/secret manager.
- Todos os clientes usam Authorization Code + PKCE S256; implicit não existe.
- Build e Playwright rodam somente no GitHub Actions.
- Nenhum commit ou push antes do módulo completo, validações locais, evidências e screenshots.
- Marca e textos usam PARTSAGRICOLA em `pt-BR`, `es` e `en`.
- Dados dinâmicos escapados; tokens/cookies nunca aparecem em logs ou evidências.

## Review Focus

- Corrida entre uso/rotação/revogação de refresh token deve produzir uma única cadeia válida e revogar a família ao detectar replay.
- Authorization code deve ser uso único e vinculado ao mesmo client, redirect e verifier PKCE.
- Callback social com e-mail já existente jamais deve vincular conta sem autenticação explícita.
- Logout global deve invalidar imediatamente access token JWT ainda dentro do TTL por introspecção.
- ADMIN/FINANCE sem enrollment ou desafio TOTP válido não deve receber código OIDC.

---

### Task 1: Persistência de identidade e segurança

**Files:**

- Create: `packages/db/sql/003_auth_identity.sql`
- Create: `packages/db/src/auth-domain.test.ts`
- Modify: `packages/db/sql/seed_marketplace.sql`
- Modify: `packages/db/src/seed.test.ts`

**Interfaces:**

- Produces: tabelas `auth_credential`, `auth_identity`, `auth_role`, `auth_user_role`, `auth_session`, `auth_transaction`, `auth_authorization_code`, `auth_refresh_token`, `auth_one_time_token`, `auth_social_signup`, `auth_connector`, `auth_client`.
- Produces: constraints e índices para hashes únicos, expiração, família de refresh, client redirects e memberships ativas.

- [ ] **Step 1: Write failing schema and constraint tests**

Testar inventário, ausência de colunas de segredo social, unicidade de e-mail/CPF social, códigos de uso único, redirects allowlisted, papel global e preservação de `app_user` existente.

- [ ] **Step 2: Run DB tests and verify RED**

Run: `MARKETPLACE_TEST_ADMIN_URL=... pnpm --filter @partsagricola/db test`
Expected: FAIL porque migration/tabelas não existem.

- [ ] **Step 3: Implement migration and idempotent seed**

Usar UUIDs, hashes `bytea`, timestamps explícitos, FKs `ON DELETE RESTRICT`, checks de estado/expiração e nenhum segredo bruto.

- [ ] **Step 4: Run DB suite and verify GREEN**

### Task 2: Núcleo criptográfico e repositório de autenticação

**Files:**

- Create: `apps/auth/src/config.ts`
- Create: `apps/auth/src/crypto.ts`
- Create: `apps/auth/src/repository.ts`
- Create: `apps/auth/src/passwords.ts`
- Create: `apps/auth/src/totp.ts`
- Create: `apps/auth/src/core.test.ts`
- Modify: `apps/auth/package.json`
- Modify: `apps/auth/.env.example`

**Interfaces:**

- Produces: `parseAuthConfig(env): AuthConfig`.
- Produces: `hashPassword`, `verifyPassword`, `digestToken`, `digestCpf`, `encryptSecret`, `decryptSecret`.
- Produces: `AuthRepository` com operações transacionais de usuário, sessão, code, refresh family, token único e roles.
- Produces: `TotpService.enroll/verify/useRecoveryCode`.

- [ ] **Step 1: Write failing config and crypto tests**

Cobrir fail-fast em produção, Argon2id, HMAC determinístico sem CPF bruto, AES-GCM adulterado, token digest e TOTP/recovery code de uso único.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Add pinned dependencies and implement minimal core**

Adicionar `argon2`, `jose`, `otplib`, `pg`, `nodemailer`, `@fastify/cookie` e `@fastify/formbody` em versões compatíveis com Node 22.

- [ ] **Step 4: Add real PostgreSQL repository tests**

Cobrir cadastro, e-mail/CPF para a mesma conta, verificação/reset atômicos, memberships ativos, sessão expirada/revogada e refresh concorrente/replay.

- [ ] **Step 5: Implement repository transactions and verify GREEN**

### Task 3: Protocolo OIDC, SSO e logout global

**Files:**

- Create: `apps/auth/src/oidc.ts`
- Create: `apps/auth/src/tokens.ts`
- Create: `apps/auth/src/oidc.test.ts`
- Modify: `apps/auth/src/app.ts`
- Modify: `apps/auth/src/server.ts`
- Modify: `apps/auth/src/app.test.ts`

**Interfaces:**

- Consumes: `AuthRepository`, `AuthConfig`, helpers criptográficos.
- Produces: discovery, JWKS, `/authorize`, `/token`, `/userinfo`, `/session/introspect`, `/logout`.
- Produces: claims `sub`, `sid`, `jti`, `roles`, `seller_ids`, `email_verified`.

- [ ] **Step 1: Write failing discovery/client/redirect tests**

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement discovery, JWKS and authorization transaction**

- [ ] **Step 4: Write failing PKCE/code/token tests**

Cobrir verifier errado, plain recusado, redirect/client divergente, code expirado/reutilizado e nonce preservado.

- [ ] **Step 5: Implement code exchange, JWT and introspection**

- [ ] **Step 6: Write failing refresh/logout concurrency tests**

- [ ] **Step 7: Implement rotation, replay-family revocation and global logout**

- [ ] **Step 8: Verify complete auth suite GREEN**

### Task 4: Identidade local, e-mails e conectores sociais

**Files:**

- Create: `apps/auth/src/accounts.ts`
- Create: `apps/auth/src/mailer.ts`
- Create: `apps/auth/src/social.ts`
- Create: `apps/auth/src/accounts.test.ts`
- Create: `apps/auth/src/social.test.ts`
- Modify: `apps/auth/src/app.ts`

**Interfaces:**

- Produces: cadastro local, verificação, reset, login email/CPF e desafio TOTP.
- Produces: `SocialConnector` para Google/Facebook/Apple/Microsoft e callback seguro.
- Produces: `MailTransport` real SMTP e memória somente em teste.

- [ ] **Step 1: Write failing local account lifecycle tests**

Cobrir resposta anti-enumeração, verificação/reset de uso único, reset revogando sessões, CPF opcional e rate limit persistente.

- [ ] **Step 2: Verify RED and implement lifecycle**

- [ ] **Step 3: Write failing connector visibility/config tests**

Cobrir somente ativos, segredo ausente fail-closed e nenhuma serialização do segredo.

- [ ] **Step 4: Write failing social account-link tests**

Cobrir Google mock novo, email existente sem auto-link, email não verificado e signup provisório em dois passos.

- [ ] **Step 5: Implement connectors and verify GREEN**

### Task 5: Tela acessível e multilíngue

**Files:**

- Create: `apps/auth/src/views.ts`
- Create: `apps/auth/src/locales.ts`
- Create: `apps/auth/src/views.test.ts`
- Modify: `apps/auth/src/app.ts`
- Modify: `packages/ui/src/styles.css`

**Interfaces:**

- Produces: HTML escapado para login, cadastro, complementação, verificação, reset e TOTP em `pt-BR`, `es`, `en`.

- [ ] **Step 1: Write failing semantic/i18n tests**

Cobrir labels, landmarks, locale fallback, conectores ativos, erros acessíveis, CSRF/state oculto e ausência de segredo/token renderizado.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement views and responsive auth design tokens**

Aplicar foco visível, 320 px sem overflow, dark mode, reduced motion e cópia PARTSAGRICOLA.

- [ ] **Step 4: Verify GREEN**

### Task 6: Sessão compartilhada nos três Next.js

**Files:**

- Create: `packages/shared/src/auth.ts`
- Create: `packages/shared/src/auth.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`
- Create: `apps/web/src/middleware.ts`
- Create: `apps/seller/src/middleware.ts`
- Create: `apps/admin/src/middleware.ts`
- Create: `apps/web/src/app/auth/callback/route.ts`
- Create: `apps/seller/src/app/auth/callback/route.ts`
- Create: `apps/admin/src/app/auth/callback/route.ts`
- Modify: app package manifests and env examples.

**Interfaces:**

- Produces: `introspectSession`, `requireGlobalRole`, `requireSellerScope`, `createOidcLogin`, `exchangeAuthorizationCode`.

- [ ] **Step 1: Write failing guard and PKCE client tests**

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement web-standard shared client and guards**

- [ ] **Step 4: Integrate minimal middleware/callbacks in web, seller and admin**

- [ ] **Step 5: Verify unit/integration suite GREEN**

### Task 7: E2E, screenshots, CI and documentation

**Files:**

- Create: `tests/e2e/auth.spec.ts`
- Create: `docs/AUTENTICACAO.md`
- Create: `docs/evidencias/avl-168-auth.md`
- Create: `docs/evidencias/avl-168-login-desktop.png`
- Create: `docs/evidencias/avl-168-login-mobile.png`
- Modify: `playwright.config.ts`
- Modify: `.github/workflows/monorepo.yml`
- Modify: `README.md`
- Modify: `docs/ARQUITETURA-INICIAL.md`
- Modify: `package.json`
- Modify: `turbo.json`

**Interfaces:**

- Consumes: módulo completo.
- Produces: homologação automatizada e documentação operacional sem credenciais.

- [ ] **Step 1: Add E2E for email signup, Google mock, SSO and global logout**

- [ ] **Step 2: Configure GitHub-only auth environment and screenshot artifacts**

- [ ] **Step 3: Document keys, SMTP, connectors, clients, TTLs, bootstrap and recovery**

- [ ] **Step 4: Run local no-build gate**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && MARKETPLACE_TEST_ADMIN_URL=... pnpm test && git diff --check`

- [ ] **Step 5: Request whole-module review and fix Critical/Important findings**

- [ ] **Step 6: Create the single commit and push**

- [ ] **Step 7: Open ready PR and run GitHub Actions**

GitHub must pass PostgreSQL tests, Playwright desktop/mobile, screenshot capture and `pnpm build`.

- [ ] **Step 8: Update Linear AVL-168 with evidence and mark Done**
