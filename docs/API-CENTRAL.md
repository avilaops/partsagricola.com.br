# API central

O módulo AVL-169 estabelece a fronteira HTTP comum do marketplace. Ele não
implementa regras comerciais dos módulos posteriores: entrega contratos,
segurança, persistência de auditoria e processamento de mídia reutilizáveis.

## Rotas e contrato

- Health: `GET /v1/health`.
- OpenAPI 3.1: `GET /v1/openapi.json`.
- Swagger UI: `GET /v1/docs`.
- Sessão: `GET /v1/session` com Bearer token.
- Bases de domínio: `catalog`, `sellers`, `listings`, `requests`, `proposals`,
  `chat`, `orders`, `payments`, `shipping`, `reviews`, `moderation`, `admin` e
  `markets` sob `/v1`.
- Upload: `POST /v1/uploads/sign` e `POST /v1/uploads/complete`.
- Referências para formulários: `GET /v1/catalog/reference-data`.
- Cadastro de empresa anunciante: `POST /v1/sellers/applications`.
- Solicitação de peça: `POST /v1/requests`.
- Indicadores da empresa: `GET /v1/sellers/dashboard` com `x-seller-id`.

Erros usam `{ "error": { "code", "message", "requestId", "details"? } }`.
Listas usam `{ "data": [], "page": { "nextCursor": null } }`; o cursor é
opaco. Token ausente ou inválido retorna 401. Papel ou empresa incompatível
retorna 403 com `AUTH_FORBIDDEN` ou `SELLER_SCOPE_FORBIDDEN`.

O mercado pode ser informado por query `market`, header `x-market` ou domínio.
Fontes explícitas conflitantes são rejeitadas. Operações de empresa exigem
`x-seller-id` e conferem o vínculo presente na sessão.

## Cliente gerado

Não edite `packages/api-client/src/schema.ts`. Regenere e valide o diff:

```bash
pnpm api:generate
git diff --exit-code -- apps/api/openapi.json packages/api-client/src/schema.ts
```

Web, seller e admin usam `createApiClient`; chamadas diretas com `fetch` não
devem ser adicionadas a esses aplicativos.

## Imagens

1. O cliente solicita uma URL assinada informando MIME e tamanho.
2. Envia JPEG, PNG ou WebP diretamente ao bucket.
3. Confirma a chave recebida em `/v1/uploads/complete`.
4. O worker gera WebP 480, 960 e 1600 sem EXIF.
5. O job só vira `COMPLETED` depois que todos os derivados foram publicados.

Chaves são produzidas pelo servidor, o limite padrão é 10 MiB e a assinatura
expira em cinco minutos. Jobs falhos voltam a ficar disponíveis após cinco
minutos, até dez tentativas.

## Variáveis

API e worker usam `DATABASE_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` e `S3_FORCE_PATH_STYLE`. A API também
usa `AUTH_ORIGIN`, `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_MAX` e
`UPLOAD_MAX_BYTES`. Os frontends usam `API_ORIGIN`. Valores reais devem ficar no
gerenciador de segredos, nunca no repositório.

## Validação

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm format:check
```

O CI cria PostgreSQL descartável, aplica migrations e seeds, valida o snapshot
OpenAPI e captura `/v1/docs` em desktop e mobile.

- [Swagger UI desktop](evidencias/avl-169-api-docs-desktop.png)
- [Swagger UI mobile](evidencias/avl-169-api-docs-mobile.png)
