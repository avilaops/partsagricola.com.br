# PARTSAGRICOLA

[![Monorepo](https://github.com/avilaops/partsagricola.com.br/actions/workflows/monorepo.yml/badge.svg)](https://github.com/avilaops/partsagricola.com.br/actions/workflows/monorepo.yml)
[![Catálogo PostgreSQL](https://github.com/avilaops/partsagricola.com.br/actions/workflows/catalogo-postgres.yml/badge.svg)](https://github.com/avilaops/partsagricola.com.br/actions/workflows/catalogo-postgres.yml)

Marketplace B2B para empresas comprarem e venderem produtos, equipamentos e
soluções para o setor agrícola.

A PARTSAGRICOLA é a plataforma que conecta compradores a empresas anunciantes.
Ela não opera como uma loja ou e-commerce com estoque e catálogo próprios:
cada empresa é responsável por seus anúncios, condições comerciais e oferta.

## Visão do produto

- Empresas verificadas criam seus perfis e publicam anúncios.
- Compradores pesquisam, comparam e negociam dentro da plataforma.
- Administração, moderação e auditoria protegem a qualidade do marketplace.
- Dados históricos de catálogos servem apenas como referência técnica e não
  representam estoque, propriedade ou venda direta da PARTSAGRICOLA.
- Odoo e Medusa não fazem parte da arquitetura vigente.

A base técnica está organizada como monorepo pnpm/Turborepo e evolui de forma
incremental conforme [a arquitetura inicial](docs/ARQUITETURA-INICIAL.md).

## Componentes

| Workspace     | Porta | Responsabilidade                        |
| ------------- | ----: | --------------------------------------- |
| `apps/web`    |  3000 | Marketplace para compradores            |
| `apps/seller` |  3001 | Portal das empresas anunciantes         |
| `apps/admin`  |  3002 | Administração da operação               |
| `apps/api`    |  4100 | API principal                           |
| `apps/auth`   |  4101 | Serviço de autenticação                 |
| `apps/worker` |  4102 | Processamento assíncrono e health check |

Os pacotes compartilhados ficam em `packages/`: configuração, banco, cliente de
API, internacionalização, providers, contratos comuns e sistema de interface.

## Design system

`packages/ui` concentra os tokens e componentes usados por web, seller, admin e
autenticação. A galeria completa fica em `http://localhost:3002/ui` durante o
desenvolvimento e cobre estados, interações e layouts responsivos.

- Verde de marca `#0B6B3F`, verde de ação, dourado funcional e neutros são
  expostos por `@partsagricola/ui/tokens` e variáveis `--pa-*`.
- Inter é a tipografia de leitura; Manrope identifica títulos e valores.
- A marca histórica é reutilizada sem redesenho e seu hash está documentado em
  [`assets/brand/partsagricola`](assets/brand/partsagricola/README.md).
- O marketplace não apresenta carrinho, checkout ou estoque próprio.

Evidências Playwright: [desktop](docs/evidencias/avl-170/ui-desktop.png) e
[mobile](docs/evidencias/avl-170/ui-mobile.png).

## Execução local

Pré-requisitos: Node.js 20+, Corepack e Docker com Compose.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm infra:up
DATABASE_URL=postgresql://partsagricola:partsagricola@localhost:55432/partsagricola pnpm db:migrate
DATABASE_URL=postgresql://partsagricola:partsagricola@localhost:55432/partsagricola pnpm db:seed
pnpm dev
```

Serviços de infraestrutura local:

| Serviço       | Endereço local                         |
| ------------- | -------------------------------------- |
| PostgreSQL 16 | `127.0.0.1:55432`                      |
| Redis 7       | `127.0.0.1:56379`                      |
| MinIO         | `127.0.0.1:59000` (console em `59001`) |
| Mailpit       | `http://127.0.0.1:58025`               |

Todas as portas são ligadas apenas ao loopback no ambiente local.

## Qualidade e validação

Todo pull request é validado no GitHub Actions. O pipeline executa:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm format:check
```

A suíte Playwright verifica os três frontends em Chromium desktop e emulação
móvel, incluindo landmarks, navegação por teclado, overflow horizontal e erros
de console.

O pipeline está em `.github/workflows/monorepo.yml`. A migration inicial é
idempotente e fica em `packages/db/sql/001_foundation.sql`. O domínio do
marketplace é criado pela migration `002_marketplace_domain.sql`; o pipeline
usa um PostgreSQL 16 descartável para comprovar migrations, seeds, isolamento
entre empresas e importação transacional.

## Banco do marketplace

O schema `marketplace` contém empresas anunciantes, catálogo de referência,
anúncios, interesses, propostas e conversas. Não contém carrinho, pedido,
pagamento, estoque ou logística.

```bash
DATABASE_URL=postgresql://partsagricola:partsagricola@127.0.0.1:55432/partsagricola pnpm db:migrate
DATABASE_URL=postgresql://partsagricola:partsagricola@127.0.0.1:55432/partsagricola pnpm db:seed
DATABASE_URL=postgresql://partsagricola:partsagricola@127.0.0.1:55432/partsagricola pnpm db:import:catalog -- packages/db/fixtures/catalog-example.csv
```

O contrato CSV, operação segura e fronteira com o catálogo histórico estão em
[Banco do marketplace](docs/BANCO-MARKETPLACE.md).

## Configuração

Copie `.env.example` para `.env` e substitua segredos antes de usar outro
ambiente. O arquivo `.env` nunca deve ser versionado. Serviços HTTP usam
`HOST=127.0.0.1` por padrão; exposição externa deve ser feita por proxy com TLS,
autenticação e limites de requisição.

O login é centralizado em `apps/auth` por OIDC Authorization Code + PKCE, com SSO para web, fornecedor e administração. Consulte [docs/AUTENTICACAO.md](docs/AUTENTICACAO.md) para configuração, conectores, TTLs e recuperação.

## API central

`apps/api` expõe contratos versionados em `/v1`, documentação interativa em
`/v1/docs` e o documento OpenAPI em `/v1/openapi.json`. Autenticação, papéis,
escopo da empresa anunciante, mercado, CORS, rate limit e erros são aplicados de
forma uniforme. O cliente de `packages/api-client` é gerado desse contrato e é
usado por web, seller e admin.

Uploads de imagens são enviados diretamente ao MinIO/S3 por URL assinada. Após
a confirmação, `apps/worker` gera WebP sem EXIF nas larguras 480, 960 e 1600 e
mantém falhas recuperáveis na fila PostgreSQL. A operação e os exemplos estão
em [API central](docs/API-CENTRAL.md).

## Automação n8n

[`n8n/partsagricola-operacao.ts`](n8n/partsagricola-operacao.ts) mantém o
workflow operacional versionado. O rascunho desativado cobre cadastro e
aprovação de empresas, moderação e publicação de anúncios, interesse comercial,
deduplicação e eventos desconhecidos. Não há automação de pedido, pagamento,
frete ou checkout. Publicação exige autorização explícita.

Evidências visuais da homologação:

- [Fluxo e execuções — desktop](docs/evidencias/n8n-fluxo-operacional.png)
- [Fluxo e execuções — mobile](docs/evidencias/n8n-fluxo-operacional-mobile.png)
- [Fonte reproduzível das evidências](docs/evidencias/n8n-fluxo-operacional.html)

## Documentação

- [Arquitetura incremental](docs/ARQUITETURA-INICIAL.md)
- [Banco do marketplace](docs/BANCO-MARKETPLACE.md)
- [API central](docs/API-CENTRAL.md)
- [Evidência da API desktop](docs/evidencias/avl-169-api-docs-desktop.png)
- [Evidência da API mobile](docs/evidencias/avl-169-api-docs-mobile.png)
- [Design system AVL-170 — decisão](docs/superpowers/specs/2026-10-18-avl-170-design-system-design.md)
- [Design system AVL-170 — execução](docs/superpowers/plans/2026-10-18-avl-170-design-system.md)
- [Guia de uso do design system](docs/DESIGN-SYSTEM.md)
- [Evidências do AVL-167](docs/evidencias/avl-167-schema-marketplace.md)
- [Decisão de design do AVL-166](docs/superpowers/specs/2026-10-17-avl-166-design.md)
- [Plano executado do AVL-166](docs/superpowers/plans/2026-10-17-avl-166.md)

Materiais e scripts antigos ainda presentes fora da árvore do monorepo são
artefatos legados de importação. Eles não definem a arquitetura atual e devem
ser migrados ou aposentados em fatias posteriores, com preservação de dados.

## Storefront público

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
