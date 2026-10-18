# API central — desenho do módulo AVL-169

## Intenção

Fornecer a fronteira HTTP única do marketplace Parts Agrícola. A API autentica
tokens do provedor OIDC já existente, resolve o mercado da requisição, aplica
papéis globais e escopo por empresa, valida contratos e registra ações sensíveis.

## Arquitetura

- Fastify 5 organizado por plugins de domínio em `apps/api/src/modules`.
- Zod define entrada e saída; `@fastify/swagger` expõe OpenAPI 3.1 e Swagger UI
  em `/v1/docs`.
- Um hook autentica Bearer tokens por introspecção. Guards negam por padrão e
  retornam erro estável `AUTH_FORBIDDEN` ou `SELLER_SCOPE_FORBIDDEN`.
- Market é resolvido, nesta ordem, por `market` explícito, `x-market`, hostname e
  mercado padrão BR; mercados desconhecidos falham com `MARKET_NOT_FOUND`.
- Repositórios são interfaces injetáveis. PostgreSQL implementa AuditLog e fila
  de imagens; testes usam memória sem fingir comportamento do Fastify.
- Uploads usam URLs S3 v4 assinadas e chaves controladas pelo servidor. O worker
  lê jobs, remove metadados e gera WebP 480/960/1600 com Sharp.
- O cliente tipado encapsula todas as chamadas HTTP dos apps; não há `fetch`
  direto nos três frontends.

## Contratos transversais

- Erro: `{ error: { code, message, requestId, details? } }`.
- Lista: `{ data, page: { nextCursor } }`, cursor opaco base64url.
- CORS aceita somente a allowlist configurada e requisições sem Origin.
- Rate limit usa chave por principal/IP e responde `RATE_LIMITED`.
- Logs Pino incluem requestId, principal e market, nunca token ou segredo.
- Ações sensíveis registram ator, empresa, mercado, ação, entidade, IP e diff.

## Segurança e limites

URLs assinadas aceitam somente JPEG, PNG e WebP, tamanho máximo configurável e
expiração curta. Chaves impedem path traversal. Auditoria nunca guarda token.
Pedidos, pagamentos e frete recebem apenas rotas-base autenticadas neste módulo;
regras comerciais pertencem aos tickets posteriores.

## Aceite

OpenAPI e health funcionam, todos os módulos estão registrados, 403 possui código
estável, mercado e paginação são determinísticos, upload/worker são testados com
bytes reais, auditoria persiste em PostgreSQL e os três frontends usam o cliente.
