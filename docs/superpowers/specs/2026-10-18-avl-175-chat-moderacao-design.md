# AVL-175 Chat e Moderação — Design

## Intenção

Entregar comunicação interna segura entre compradores e empresas anunciantes sem expor contato externo. Toda conversa pertence a um objeto comercial, todo texto e imagem passa por moderação e a equipe operacional consegue revisar, sancionar e auditar ocorrências.

## Escopo

- Conversas vinculadas a anúncio, solicitação, proposta ou pedido, com participantes autorizados por usuário e empresa.
- Histórico paginado, envio de texto e até quatro imagens, leitura por participante e atualização em tempo real por WebSocket com polling HTTP como fallback.
- Moderação síncrona determinística antes da gravação: normalização Unicode, números por extenso, telefone fragmentado, e-mail ofuscado, redes sociais, mensageiros e encurtadores.
- Resultado `ALLOW`, `MASK` ou `BLOCK`; conteúdo mascarado nunca preserva o contato em campos públicos.
- Análise assíncrona de texto e OCR de imagens pelo worker, usando interfaces de provedor e implementação local segura quando não houver credencial externa.
- Fila administrativa, decisão humana, histórico por usuário/empresa e sanções progressivas configuráveis.
- Denúncias de mensagens, anúncios e lojas, com deduplicação por denunciante.
- Telas responsivas para conversa e revisão administrativa, incluindo estados vazio, carregando, erro, conteúdo mascarado e fallback de conexão.

## Não objetivos

- Não criar checkout, pagamento ou venda própria.
- Não publicar workflow n8n, fazer deploy ou merge.
- Não implementar o domínio completo de pedidos; o chat aceita referência opaca de pedido até o módulo responsável introduzir sua FK.
- Não enviar telefone, e-mail ou rede social para outros participantes, logs ou eventos em tempo real.

## Arquitetura

`006_chat_moderation.sql` evolui o domínio existente com anexos, flags, jobs, denúncias, sanções e políticas. `apps/api/src/moderation` concentra o classificador puro e contratos; `apps/api/src/chat` expõe rotas e o canal WebSocket. O repositório PostgreSQL aplica escopo de participante e de mercado em todas as consultas. O worker reivindica jobs com `FOR UPDATE SKIP LOCKED`, executa texto/OCR e persiste o resultado com retentativa.

O analisador síncrono é conservador: `BLOCK` para links/contato inequívoco e `MASK` para padrões recuperáveis. A mensagem original fica somente em um campo de evidência criptograficamente resumido, não em texto claro; o corpo exibido recebe máscaras. A análise assíncrona pode elevar `ALLOW` para `MASK/BLOCK`, nunca reduzir uma decisão síncrona.

## Segurança e autorização

- Apenas participantes ativos leem, enviam, marcam leitura ou assinam eventos.
- Usuários não podem adicionar participantes arbitrários por esta API.
- Operações administrativas exigem `ADMIN` ou `SUPPORT`; configuração de sanções exige `ADMIN`.
- Imagens usam chaves já assinadas e pertencentes à empresa/usuário autorizados.
- Anexos permanecem em quarentena e não recebem URL de leitura para outros participantes até resultado assíncrono `ALLOW`; `MASK`, `BLOCK`, OCR indisponível ou falha seguem para revisão manual.
- Rate limit específico para mensagens e denúncias, limites de tamanho e paginação por cursor.
- Auditoria registra decisões e sanções sem conteúdo sensível.

## Aceite verificável

- Matriz com pelo menos 50 tentativas disfarçadas e taxa mínima de 95% em `MASK` ou `BLOCK`.
- Testes PostgreSQL provam escopo, vínculo, leitura, anexos, denúncia, revisão e sanção.
- Testes de API provam autenticação, fallback HTTP, WebSocket, cursor e RBAC.
- Testes de worker provam claim idempotente, elevação de decisão e falha com retentativa.
- Playwright comprova conversa e fila administrativa em desktop e mobile, com prints versionados.

## Decisões do executor

- WebSocket usa `@fastify/websocket`; polling `GET /v1/chat/conversations/:id/messages` é o fallback explícito.
- O provedor local de OCR não inventa texto: recebe texto extraído por adaptador configurado; sem OCR externo, imagens permanecem em quarentena para revisão manual.
- Uma conversa pode ter exatamente um contexto entre `LISTING`, `REQUEST`, `PROPOSAL` e `ORDER`.
- A autorização de contexto é um contrato injetável. `ORDER` exige um resolvedor confiável do futuro módulo de pedidos e falha fechado enquanto ele não estiver configurado; os outros contextos são verificados no PostgreSQL.
- O texto original necessário à análise assíncrona é armazenado cifrado com AES-256-GCM em uma tabela de evidência de acesso exclusivo do worker, usando `MODERATION_EVIDENCE_KEY`, e apagado após processamento ou no máximo em sete dias. APIs, eventos, logs e revisores recebem apenas corpo seguro, motivos e fragmentos já redigidos.
- Por regra do projeto, haverá um único commit e push somente depois de testes e evidências visuais completos.
