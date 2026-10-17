# AVL-167 — Banco e domínio do marketplace

## Intenção

A PARTSAGRICOLA será um classificado B2B: empresas aprovadas anunciam peças ou
máquinas, compradores registram interesse, negociam propostas e conversam com
o anunciante. A plataforma facilita o encontro e a negociação, mas não cria
pedido, cobra, controla estoque, entrega ou liquida a venda.

## Decisões de arquitetura

- Manter PostgreSQL 16, migrations SQL idempotentes e o driver `pg` já usados
  por `packages/db`; não introduzir Prisma só porque aparecia no escopo antigo.
- Criar o schema `marketplace`, separado dos schemas legados `catalogo` e
  `imdepa`. O catálogo legado continua imutável e pode ser importado por uma
  ponte explícita.
- Usar UUIDs para entidades operacionais e slugs/códigos naturais apenas como
  chaves únicas auxiliares.
- Toda entidade pertencente a anunciante recebe `company_id`. Relacionamentos
  críticos usam chaves estrangeiras compostas para impedir cruzamento entre
  empresas.
- Valores são apenas informativos: `amount_minor bigint` e `currency char(3)`;
  preço pode ser ausente quando o anúncio estiver “sob consulta”.
- Datas são `timestamptz`; dados flexíveis e snapshots auditáveis usam `jsonb`.

## Modelo

### Identidade e empresas

- `app_user`: identidade mínima, e-mail normalizado, nome e estado.
- `company`: CNPJ único, nome, slug, contato, localização e estado de aprovação.
- `company_member`: usuário, empresa e papel (`OWNER`, `MANAGER`, `EDITOR`,
  `VIEWER`).
- `company_document`: metadados do documento e estado de revisão; nunca armazena
  segredo ou documento binário dentro do banco.

### Catálogo de referência

- `market`, `currency`, `machine_type`, `brand`, `machine_model` e
  `part_category` formam os dados de referência.
- `part` representa uma peça canônica sem vendedor e sem estoque.
- `part_code` guarda códigos originais e equivalentes com normalização única.
- `part_fitment` liga peça a modelo, ano inicial/final e observação técnica.
- `legacy_catalog_link` registra origem, ID externo e entidade importada, sem
  acoplar o domínio novo aos schemas históricos.

### Anúncios

- `listing` pertence a uma empresa e referencia opcionalmente uma peça canônica.
  O tipo distingue `PART` e `MACHINE`; condição e localização são filtros.
- Estados: `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `PAUSED`, `REJECTED`,
  `ARCHIVED`.
- Apenas empresa `APPROVED` pode gravar um anúncio como `PUBLISHED`; um trigger
  transacional protege qualquer cliente, não apenas a futura API.
- `listing_image` mantém ordenação, URL, texto alternativo e imagem principal.
  Não há quantidade disponível nem reserva de estoque.

### Relação comercial

- `favorite`: usuário e anúncio, sem duplicidade.
- `part_request` e `part_request_image`: solicitação pública ou privada do
  comprador por uma peça ainda não encontrada. `target_company_id` nulo indica
  solicitação pública; preenchido indica a empresa destinatária.
- `listing_interest`: interesse do comprador em um anúncio, com empresa
  anunciante copiada e protegida por FK composta. O comprador é sempre um
  usuário e pode, opcionalmente, agir em nome de uma empresa compradora.
- `proposal`: proposta ou contraproposta vinculada ao interesse, com autor,
  direção, estado e destinatário inequívocos; valor é informativo e não gera
  pedido ou cobrança.
- `conversation`, `conversation_participant` e `message`: negociação interna
  vinculada a exatamente um interesse ou uma solicitação. Participantes são
  únicos e apenas participantes podem ser remetentes de mensagens.
- `notification`, `audit_log`, `app_setting` e `feature_flag`: operação e
  rastreabilidade.

## Busca e integridade

- `pg_trgm` e `unaccent` suportam busca por título, descrição, códigos e marca.
- Índices cobrem status/publicação, empresa, categoria, marca, condição,
  estado/cidade e valores informativos.
- CNPJ, e-mail e códigos são normalizados por funções imutáveis.
- Constraints impedem ano final anterior ao inicial, preço negativo, moeda
  inexistente e participação duplicada em conversa. Anúncios `PART` e `MACHINE`
  podem ser livres, sem vínculo canônico, mas exigem título e descrição; os
  vínculos `part_id` e `machine_model_id`, quando presentes, devem corresponder
  ao tipo do anúncio.
- Nenhuma tabela chamada ou destinada a carrinho, pedido, pagamento, split,
  repasse, envio, devolução ou estoque será criada.

## Migrations, seeds e importação

- O executor passa a aplicar todos os arquivos `packages/db/sql/*.sql` em ordem,
  dentro de transações e com uma tabela de histórico de migrations. Usa lock
  consultivo, checksum imutável e registra a migration fundacional existente
  como baseline após executá-la idempotentemente.
- O seed usa UPSERT e pode ser repetido. Cria Brasil ativo, BRL, tipos de
  máquina, marcas e categorias iniciais; outros países/moedas não são ativados
  neste módulo.
- O importador CSV aceita cabeçalho versionado, valida toda linha antes de
  persistir e faz UPSERT por `source + external_id`. Uma linha inválida aborta a
  importação inteira, preservando atomicidade.
- A auditoria do catálogo legado documenta o que é fonte, o que é derivado e
  quais campos podem alimentar `part`, `part_code` e `part_fitment`.

## Segurança e privacidade

- Queries futuras recebem `company_id` explicitamente; nenhuma função de banco
  escolhe empresa por um valor fornecido apenas pelo cliente.
- Contatos ficam privados por padrão. A futura API decidirá sua exposição após
  interesse ou conversa; o banco não assume que e-mail ou telefone seja público.
- Logs e auditoria guardam IDs e metadados, não documentos, tokens ou conteúdo
  sensível integral.
- CNPJ e e-mail ficam protegidos por unicidade normalizada. Exclusões destrutivas
  são evitadas nas entidades comerciais; estados e timestamps preservam o
  histórico.
- Normalização usa `lower(trim(email))`, apenas dígitos para CNPJ e códigos em
  maiúsculas sem separadores controlados; não declara `unaccent` como imutável.

## Escolhas de implementação

- Todas as novas tabelas, enums e funções vivem em `marketplace`. As tabelas
  `public.app_setting` e `public.outbox_event` permanecem onde estão por
  compatibilidade; sua migração não pertence a esta fatia.
- Estados mínimos são constraints textuais documentadas, mantendo evolução
  possível sem recriar enums PostgreSQL.
- FKs comerciais usam `RESTRICT`; `CASCADE` fica restrito a imagens e vínculos
  auxiliares que não apagam histórico negocial.
- O importador recebe CSV UTF-8 com `schema_version`, valida o arquivo inteiro e
  produz relatório determinístico antes do commit transacional.
- Testes locais usam o PostgreSQL do `infra/docker-compose.yml` na porta 55432;
  o compose da raiz pertence ao catálogo legado e não será alterado.

## Testes e evidências

- Testes de contrato estáticos impedem o retorno de entidades de e-commerce ou
  colunas monetárias float.
- Testes PostgreSQL 16 criam banco descartável, aplicam e reaplicam migrations e
  seeds, comprovam constraints, índices, isolamento e importação idempotente.
- Testes Node cobrem descoberta/aplicação de migrations, parser CSV e erros.
- O GitHub Actions executará lint, typecheck, testes, Playwright existente e
  build. Nenhum build será executado no servidor de trabalho.
- Evidências finais incluem relatório do schema, contagens de seed e resultados
  dos cenários críticos; não há tela de produto neste módulo de banco.

## Fora do escopo

Autenticação completa, APIs HTTP, frontend, envio de notificações, checkout,
pagamento, comissão, logística, estoque, Odoo e publicação em produção.
