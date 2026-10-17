# Fluxo operacional n8n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar e testar o roteamento operacional assíncrono do marketplace.

**Architecture:** A aplicação emite envelopes v1; um workflow desativado normaliza, deduplica, roteia e prepara notificações sem executar regras de negócio. Cada rota é independente e eventos desconhecidos possuem saída explícita.

**Tech Stack:** n8n Workflow SDK, TypeScript versionado, Node Test, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-17-fluxo-operacional-n8n-design.md`

## Global Constraints

- Não publicar ou ativar o workflow.
- Não executar build ou testes pesados no servidor; usar GitHub Actions.
- Não introduzir carrinho, pedido, checkout, pagamento, frete ou estoque próprio.

## Review Focus

- Envelope com campos sob `body` e envelope já normalizado.
- Evento repetido não pode gerar uma segunda notificação.
- Evento desconhecido precisa de resultado rastreável.
- Cada rota deve preservar correlação e identificador da entidade.
- Testes não podem acionar serviços ou credenciais externas.

---

### Task 1: Contrato verificável

**Files:**
- Modify: `tests/monorepo/contracts.test.mjs`
- Modify: `docs/ARQUITETURA-INICIAL.md`

- [x] Criar teste que exija as cinco rotas B2B e rejeite eventos de e-commerce.
- [x] Executar no GitHub Actions e comprovar a falha anterior à implementação.

### Task 2: Workflow operacional

**Files:**
- Modify: `n8n/partsagricola-operacao.ts`

- [x] Normalizar o envelope e deduplicar por `id`.
- [x] Rotear os cinco tipos de evento e a saída desconhecida.
- [x] Preparar notificações sem serviço externo.
- [x] Validar o código com o n8n Workflow SDK.

### Task 3: Homologação

**Files:**
- Modify: `README.md`
- Modify: `docs/ARQUITETURA-INICIAL.md`

- [x] Criar o workflow desativado no n8n.
- [x] Executar todas as rotas com pin data e inspecionar as saídas.
- [ ] Rodar lint, typecheck, testes, Playwright e build no GitHub Actions.
- [ ] Registrar evidências no PR e no Linear.
