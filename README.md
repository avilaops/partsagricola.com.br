# PARTSAGRICOLA

Fundação do marketplace de peças agrícolas, organizada como monorepo pnpm/Turborepo.
A arquitetura vigente não utiliza Odoo. O catálogo é tratado por uma fronteira
PostgreSQL própria e incremental, conforme [a arquitetura inicial](docs/ARQUITETURA-INICIAL.md).

## Componentes

| Workspace     | Porta | Responsabilidade                        |
| ------------- | ----: | --------------------------------------- |
| `apps/web`    |  3000 | Marketplace público                     |
| `apps/seller` |  3001 | Portal de fornecedores                  |
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

O pipeline equivalente está em `.github/workflows/monorepo.yml`. A migration
inicial é idempotente e fica em `packages/db/sql/001_foundation.sql`.

## Configuração

Copie `.env.example` para `.env` e substitua segredos antes de usar outro
ambiente. O arquivo `.env` nunca deve ser versionado. Serviços HTTP usam
`HOST=127.0.0.1` por padrão; exposição externa deve ser feita por proxy com TLS,
autenticação e limites de requisição.

## Automação n8n

`n8n/partsagricola-operacao.ts` mantém o workflow versionado e validado
estruturalmente. Os comandos deste repositório não publicam nem ativam o
workflow. Publicação exige autorização explícita e credenciais do ambiente.

## Documentação

- [Arquitetura incremental](docs/ARQUITETURA-INICIAL.md)
- [Decisão de design do AVL-166](docs/superpowers/specs/2026-10-17-avl-166-design.md)
- [Plano executado do AVL-166](docs/superpowers/plans/2026-10-17-avl-166.md)

Materiais e scripts antigos ainda presentes fora da árvore do monorepo são
artefatos legados de importação. Eles não definem a arquitetura atual e devem
ser migrados ou aposentados em fatias posteriores, com preservação de dados.
