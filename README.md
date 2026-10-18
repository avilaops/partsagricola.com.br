# Parts Agrícola

Marketplace B2B que conecta compradores do agro a empresas anunciantes.

> A Parts Agrícola é uma plataforma de compra e venda, não uma loja. A
> plataforma não vende peças, não mantém estoque próprio e não opera catálogo
> próprio. Os anúncios e as condições comerciais pertencem às empresas
> participantes.

## Estado atual

- Storefront público em Next.js 15, dentro de [`storefront/`](storefront/).
- Home, navegação e contato orientados a compradores e empresas anunciantes.
- Rotas públicas históricas de catálogo, produto, categoria, coleção, aplicação
  e medidas são redirecionadas permanentemente para a home do marketplace.
- APIs antigas de busca e cotação retornam `410 Gone`.
- Sitemap, `robots.txt` e `llms.txt` não promovem mais catálogo próprio.
- Testes de política de rotas, typecheck, build e Playwright desktop/mobile são
  executados pelo GitHub Actions.

## Estrutura

```text
.
├── storefront/             # interface pública do marketplace
├── apps/                   # aplicações incrementais do monorepo
├── packages/               # pacotes compartilhados
├── n8n/                    # automações versionadas, não publicadas automaticamente
├── docs/                   # arquitetura e decisões técnicas
├── sql/, data/, images/    # acervo legado preservado, fora da experiência pública
└── .github/workflows/      # validações executadas no GitHub
```

Os diretórios de dados e extração permanecem no histórico técnico para
rastreabilidade; eles não definem o produto público e não devem ser reativados
como catálogo da plataforma.

## Executar o storefront

Requisitos: Node.js 24 e npm.

```bash
cd storefront
npm ci --ignore-scripts
npm run dev
```

Acesse <http://localhost:8000/br>.

## Testes

```bash
cd storefront
npm test
npm run typecheck
```

Build de produção, testes Playwright, geração de prints e publicação são
realizados pelo workflow `Storefront marketplace` no GitHub. O servidor recebe
somente o runtime já compilado e validado; não execute build em produção.

## Publicação

O fluxo é branch → pull request → validações do GitHub → revisão → `main` →
deploy do artefato aprovado. A publicação usa os secrets `PRODUCTION_SSH_KEY`,
`PRODUCTION_KNOWN_HOSTS`, `PRODUCTION_HOST` e `PRODUCTION_USER`.

O projeto não usa Odoo.
