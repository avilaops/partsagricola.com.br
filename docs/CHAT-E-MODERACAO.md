# Chat e moderação

O chat mantém compradores e empresas anunciantes dentro da PARTSAGRICOLA. Ele
não representa checkout ou venda: cada conversa acompanha um anúncio,
solicitação, proposta ou referência de pedido.

## Fluxo seguro

1. O cliente autenticado lista apenas conversas das quais participa.
2. O texto passa por moderação síncrona antes de ser persistido.
3. API e WebSocket carregam somente `safeBody`; telefone, e-mail, link,
   mensageiro ou rede social são mascarados ou bloqueados.
4. O original fica cifrado em AES-256-GCM, acessível somente ao worker, e é
   eliminado depois da análise ou em no máximo sete dias.
5. Texto e OCR entram na fila assíncrona. Anexos permanecem em quarentena até
   `ALLOW`; ausência de OCR envia a imagem para revisão humana.
6. `ADMIN` e `SUPPORT` revisam a fila. Apenas `ADMIN` altera os limiares de
   advertência, suspensão e bloqueio.

## Tempo real e fallback

O browser solicita um ticket descartável válido por 60 segundos e abre
`/v1/chat/conversations/:id/events` por WebSocket. O ticket é consumido na
primeira conexão. Se o upgrade ou a rede falhar, a interface consulta o
histórico HTTP a cada cinco segundos. `clientMessageId` torna o reenvio
idempotente.

## Provedores assíncronos

O worker usa o classificador local quando a IA externa não está configurada.
Para ativar integrações HTTP:

```dotenv
MODERATION_EVIDENCE_KEY=<base64 de 32 bytes>
MODERATION_PROVIDER_URL=https://provedor.exemplo/moderate
MODERATION_PROVIDER_API_KEY=<segredo>
OCR_PROVIDER_URL=https://provedor.exemplo/ocr
OCR_PROVIDER_API_KEY=<segredo>
```

O moderador recebe `{ "text": "..." }` e responde `decision` (`ALLOW`, `MASK`
ou `BLOCK`) e `reasons`. O OCR recebe `storageKey` e responde `text`. Falhas são
retentadas; após cinco tentativas o item exige revisão. Nenhum segredo ou texto
original entra nos logs.

## Rotas

- `GET /v1/chat/conversations`
- `GET|POST /v1/chat/conversations/:id/messages`
- `POST /v1/chat/conversations/:id/read`
- `POST /v1/chat/conversations/:id/realtime-ticket`
- `GET /v1/chat/conversations/:id/events` (WebSocket)
- `POST /v1/chat/reports`
- `GET /v1/moderation/flags`
- `POST /v1/moderation/flags/:id/review`
- `GET|PUT /v1/moderation/policy`
- `GET /v1/moderation/history`

## Homologação

Use `MARKETPLACE_TEST_ADMIN_URL` somente com PostgreSQL descartável. Os modos
de evidência visual existem apenas fora de produção:

- `/conversas/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?evidence=1`
- `/administracao/moderacao?evidence=1`
