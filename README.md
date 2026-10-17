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
idempotente e fica em `packages/db/sql/001_foundation.sql`.

## Configuração

Copie `.env.example` para `.env` e substitua segredos antes de usar outro
ambiente. O arquivo `.env` nunca deve ser versionado. Serviços HTTP usam
`HOST=127.0.0.1` por padrão; exposição externa deve ser feita por proxy com TLS,
autenticação e limites de requisição.

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
- [Decisão de design do AVL-166](docs/superpowers/specs/2026-10-17-avl-166-design.md)
- [Plano executado do AVL-166](docs/superpowers/plans/2026-10-17-avl-166.md)

Materiais e scripts antigos ainda presentes fora da árvore do monorepo são
artefatos legados de importação. Eles não definem a arquitetura atual e devem
ser migrados ou aposentados em fatias posteriores, com preservação de dados.
