# AVL-170 Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o design system PARTSAGRICOLA completo e uma vitrine `/ui` homologada em desktop e mobile.

**Architecture:** O pacote `@partsagricola/ui` concentra tokens, formatação, componentes e layouts. O admin consome a biblioteca em uma página de vitrine; o auth consome somente as variáveis de tema serializadas para eliminar cores e fontes locais.

**Tech Stack:** React 19, TypeScript strict, CSS, Next.js 15, Node test runner e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-avl-170-design-system-design.md`

## Global Constraints

- Preservar logo e paleta recuperadas do storefront existente.
- Não introduzir fluxo de venda, checkout ou regra de domínio.
- Escrever testes antes do código de produção.
- Fazer um único commit e push somente depois de testes e screenshots finais.
- Manter suporte a 320 px, teclado, foco visível e movimento reduzido.

## Review Focus

- Valor monetário inválido deve produzir estado indisponível, não texto enganoso.
- Rating fora de 0–5 deve ser limitado e continuar compreensível por leitor de tela.
- Uploader deve rejeitar arquivo que não seja imagem e permitir remover preview.
- Tabs e modal devem funcionar por teclado e expor estado sem depender de cor.
- DataTable deve permanecer legível no mobile sem overflow horizontal da página.

---

### Task 1: Tokens e formatadores

**Files:**

- Create: `packages/ui/src/tokens.ts`
- Create: `packages/ui/src/format.ts`
- Test: `packages/ui/src/format.test.ts`
- Modify: `packages/ui/package.json`
- Modify: `packages/ui/src/styles.css`

**Interfaces:**

- Produces: `tokens`, `themeCssVariables`, `formatPrice`, `normalizeRating` e CSS variables `--pa-*`.

- [ ] Escrever testes falhos para moeda, valor ausente e rating limitado.
- [ ] Rodar o teste e confirmar falha pela ausência das funções.
- [ ] Implementar formatadores e tokens mínimos.
- [ ] Rodar testes e confirmar sucesso.

### Task 2: Componentes e layouts compartilhados

**Files:**

- Create: `packages/ui/src/primitives.tsx`
- Create: `packages/ui/src/interactive.tsx`
- Create: `packages/ui/src/layouts.tsx`
- Modify: `packages/ui/src/index.tsx`
- Test: `tests/monorepo/ui-system.test.mjs`

**Interfaces:**

- Consumes: tokens e formatadores da Task 1.
- Produces: todos os componentes e layouts públicos exigidos pelo AVL-170.

- [ ] Escrever teste estrutural falho para exports, semântica e ausência de tokens locais nos apps.
- [ ] Confirmar falha pelos componentes ainda ausentes.
- [ ] Implementar primitivas, interações, layouts e estilos de estados.
- [ ] Rodar testes do pacote e monorepo até ficarem verdes.

### Task 3: Vitrine `/ui` e identidade preservada

**Files:**

- Create: `apps/admin/src/app/ui/page.tsx`
- Create: `apps/admin/public/brand/logo-partsagricola.png`
- Create: `assets/brand/partsagricola/MANIFEST.md`
- Create: `assets/brand/partsagricola/logo-partsagricola.png`
- Modify: `apps/auth/src/views.ts`
- Modify: `apps/auth/package.json`
- Test: `tests/e2e/ui.spec.ts`

**Interfaces:**

- Consumes: biblioteca pública da Task 2 e `themeCssVariables` da Task 1.
- Produces: vitrine visual e evidências desktop/mobile.

- [ ] Escrever Playwright falho para todos os grupos, teclado, overflow e screenshots.
- [ ] Confirmar falha porque `/ui` ainda não existe.
- [ ] Implementar vitrine e integrar a identidade sem alterar os binários.
- [ ] Rodar Playwright e revisar visualmente os screenshots.

### Task 4: Documentação e validação final

**Files:**

- Create: `docs/DESIGN-SYSTEM.md`
- Create: `docs/evidencias/avl-170-ui-desktop.png`
- Create: `docs/evidencias/avl-170-ui-mobile.png`
- Modify: `README.md`
- Modify: `.github/workflows/monorepo.yml`

**Interfaces:**

- Consumes: módulo homologado nas Tasks 1–3.
- Produces: instruções de uso, artefatos e CI reproduzível.

- [ ] Documentar imports, tokens, acessibilidade e limites.
- [ ] Adicionar upload das evidências AVL-170 ao CI.
- [ ] Rodar lint, format, typecheck, testes, Playwright e build completos.
- [ ] Confirmar árvore limpa exceto pelos arquivos planejados.
- [ ] Criar um único commit, fazer push, abrir PR e acompanhar CI.
