# API Central Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar integralmente a fundação da API central definida no AVL-169.

**Architecture:** Plugins Fastify por domínio, contratos Zod/OpenAPI, políticas
transversais em hooks e repositórios injetáveis para persistência e storage.

**Tech Stack:** TypeScript, Fastify 5, Zod, PostgreSQL 16, S3/MinIO, Sharp.

**Spec:** `docs/superpowers/specs/2026-10-18-api-central-design.md`

## Global Constraints

- Nenhum segredo em resposta, log ou banco.
- Negar autorização por padrão e isolar toda operação por `sellerId`.
- Um único commit/push apenas após testes, build e evidências completos.

## Review Focus

- Token ausente/inválido retorna 401; papel ou empresa incorretos retorna 403.
- Host/header/param conflitantes não permitem atravessar mercado.
- Cursor inválido retorna 400 sem vazar stack.
- Upload com MIME/tamanho/chave inválidos é rejeitado antes da assinatura.
- Falha do processador mantém job recuperável e não publica arquivo parcial.

### Task 1: Contratos HTTP e infraestrutura Fastify

- [x] Escrever testes falhando para erro, cursor, market, CORS e rate limit.
- [x] Implementar plugins transversais, health versionado e OpenAPI.
- [x] Confirmar RED/GREEN com `pnpm --filter @partsagricola/api test`.

### Task 2: Autorização, domínios e auditoria

- [x] Escrever testes falhando para 401, 403 global, 403 seller e audit log.
- [x] Registrar os plugins de domínio e guards reutilizáveis.
- [x] Adicionar migration e repositório PostgreSQL de auditoria.

### Task 3: Upload e processamento

- [x] Escrever testes falhando para assinatura e três derivados sem EXIF.
- [x] Implementar gateway S3/MinIO, fila PostgreSQL e processador Sharp.
- [x] Validar falha recuperável e publicação dos derivados antes da conclusão.

### Task 4: OpenAPI e cliente tipado

- [x] Escrever testes falhando para documento e chamadas do cliente.
- [x] Gerar snapshot JSON e cliente com tipos compartilhados.
- [x] Migrar web, seller e admin para o cliente, proibindo fetch direto.

### Task 5: Homologação

- [x] Atualizar env, arquitetura, workflow e evidências.
- [x] Rodar migrations, testes, lint, typecheck, build e auditoria de segurança.
- [x] Produzir screenshots de `/v1/docs`, fazer o único commit/push e atualizar
      PR e Linear com evidências.
