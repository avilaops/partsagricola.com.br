# AVL-175 Chat e Moderação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar chat interno moderado, revisão administrativa, denúncias e processamento assíncrono com evidências completas.

**Architecture:** Persistência e invariantes no PostgreSQL, módulos Fastify isolados, classificador síncrono puro e worker assíncrono por contrato. Frontends usam API tipada e WebSocket com polling como fallback.

**Tech Stack:** PostgreSQL 16, TypeScript, Fastify 5, Zod, Next.js 15, React 19, Node test runner e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-avl-175-chat-moderacao-design.md`

## Global Constraints

- Marketplace B2B sem carrinho, checkout ou venda própria.
- Nenhum deploy, merge ou publicação n8n.
- Um único commit e push somente após módulo, testes e prints.
- Dados de contato detectados não podem aparecer em resposta, evento ou log.
- Toda consulta autenticada deve aplicar escopo de mercado e participante/empresa.
- Anexos ficam em quarentena até aprovação e evidências originais ficam cifradas por no máximo sete dias.

## Review Focus

- Telefone, e-mail e rede social fragmentados ou por extenso devem ser mascarados/bloqueados.
- Não participante não pode inferir existência nem conteúdo da conversa.
- Reconexão WebSocket não pode duplicar mensagens e o polling mantém o fluxo utilizável.
- Análise assíncrona nunca reduz uma decisão mais restritiva.
- Denúncia repetida pelo mesmo usuário não cria múltiplos casos.

---

### Task 1: Persistência e invariantes

**Files:**

- Create: `packages/db/sql/006_chat_moderation.sql`
- Create: `packages/db/src/chat-moderation.test.ts`
- Modify: `docs/BANCO-MARKETPLACE.md`

**Interfaces:**

- Produces: tabelas e constraints de contexto, anexos, flags, jobs, denúncias, políticas e sanções.

- [ ] Escrever testes de migração, quarentena, retenção e invariantes e confirmar falha antes da migração.
- [ ] Implementar migração idempotente com índices e triggers.
- [ ] Validar em PostgreSQL descartável e documentar o modelo.

### Task 2: Classificador síncrono

**Files:**

- Create: `apps/api/src/moderation/classifier.ts`
- Create: `apps/api/src/moderation/classifier.test.ts`
- Create: `apps/api/src/moderation/contact-cases.ts`

**Interfaces:**

- Produces: `moderateText(text): ModerationDecision` com `ALLOW | MASK | BLOCK`, corpo seguro e motivos.

- [ ] Criar matriz mínima de 50 casos e teste de taxa >=95%, falsos positivos e Unicode.
- [ ] Confirmar RED sem implementação.
- [ ] Implementar normalização/classificação mínima e confirmar GREEN.

### Task 3: Repositório e API de chat

**Files:**

- Create: `apps/api/src/chat/contracts.ts`
- Create: `apps/api/src/chat/repository.ts`
- Create: `apps/api/src/chat/postgres-repository.ts`
- Create: `apps/api/src/chat/routes.ts`
- Create: `apps/api/src/chat/routes.test.ts`
- Create: `apps/api/src/chat/postgres-repository.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/modules/index.ts`
- Modify: `apps/api/package.json`

**Interfaces:**

- Produces: listar/abrir conversa, histórico paginado, enviar, marcar leitura, denunciar e `/events` WebSocket.

- [ ] Escrever testes de autorização, resolvedor de contexto, paginação, quarentena de anexos, moderação, leitura, denúncia e WS/fallback.
- [ ] Confirmar RED.
- [ ] Implementar contratos, repositórios e rotas com auditoria.
- [ ] Confirmar GREEN em memória e PostgreSQL real.

### Task 4: Worker de moderação assíncrona

**Files:**

- Create: `apps/worker/src/moderation.ts`
- Create: `apps/worker/src/moderation.test.ts`
- Modify: `apps/worker/src/runtime.ts`
- Modify: `apps/worker/src/server.ts`
- Modify: `apps/worker/.env.example`

**Interfaces:**

- Consumes: jobs de moderação e contratos de provedor de texto/OCR.
- Produces: decisão elevada, flag atualizada, retentativa e revisão manual quando OCR indisponível.

- [ ] Escrever testes de claim, evidência AES-256-GCM, retenção, elevação monotônica, OCR e retentativa e confirmar RED.
- [ ] Implementar processador e integração no loop do worker.
- [ ] Confirmar GREEN.

### Task 5: Administração, políticas e sanções

**Files:**

- Create: `apps/api/src/moderation/repository.ts`
- Create: `apps/api/src/moderation/postgres-repository.ts`
- Create: `apps/api/src/moderation/routes.ts`
- Create: `apps/api/src/moderation/routes.test.ts`
- Create: `apps/admin/src/app/administracao/moderacao/page.tsx`
- Create: `apps/admin/src/app/administracao/moderacao/moderation-admin.tsx`
- Create: `apps/admin/src/app/administracao/moderacao/moderation-admin.css`
- Create: `apps/admin/src/app/administracao/moderacao/actions.ts`
- Modify: `apps/admin/src/app/page.tsx`

**Interfaces:**

- Produces: fila filtrável, decisão humana, política configurável, sanção e histórico por empresa/usuário.

- [ ] Escrever testes de RBAC, transições, sanções e ausência de conteúdo sensível e confirmar RED.
- [ ] Implementar API e tela acessível/responsiva.
- [ ] Confirmar GREEN.

### Task 6: Experiência de conversa e denúncia

**Files:**

- Create: `apps/web/src/app/conversas/[id]/page.tsx`
- Create: `apps/web/src/app/conversas/[id]/chat-client.tsx`
- Create: `apps/web/src/app/conversas/[id]/chat.css`
- Modify: `packages/api-client/src/index.ts`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/seller/src/app/page.tsx`

**Interfaces:**

- Consumes: API tipada, WebSocket e polling.
- Produces: conversa responsiva, anexos, leitura, estado de conexão e denúncia de mensagem/anúncio/loja.

- [ ] Escrever testes de contrato/cliente e confirmar RED.
- [ ] Implementar estados e acessibilidade da UI.
- [ ] Validar manualmente desktop/mobile e fluxos por Playwright.

### Task 7: Contratos, documentação e gate final

**Files:**

- Modify: `apps/api/openapi.json`
- Modify: `packages/api-client/src/schema.ts`
- Create: `docs/CHAT-E-MODERACAO.md`
- Modify: `README.md`
- Modify: `docs/ARQUITETURA-INICIAL.md`
- Create: `tests/e2e/chat-moderation.spec.ts`
- Create: `docs/evidencias/avl-175/*`

**Interfaces:**

- Produces: contrato gerado idempotente, runbook e evidências visuais.

- [ ] Gerar OpenAPI/cliente duas vezes e comparar artefatos.
- [ ] Rodar testes DB/API/worker, lint, format, typecheck, build e suíte completa.
- [ ] Rodar Playwright desktop/mobile e revisar prints.
- [ ] Fazer revisão final sem achados Critical/Important.
- [ ] Criar o único commit, push, PR empilhado, aguardar CI e atualizar Linear.
