# Banco do marketplace PARTSAGRICOLA

## Fronteiras

O schema `marketplace` é a fonte de verdade para empresas, anúncios e relações
comerciais da plataforma. Os schemas `catalogo` e `imdepa` são fontes históricas
de referência técnica; seus registros não representam estoque ou anúncios.

O banco não contém carrinho, pedido, pagamento, split, repasse, frete,
rastreamento, devolução ou estoque. Uma proposta aceita continua sendo apenas um
registro de negociação entre comprador e empresa anunciante.

## Ambiente local

Use o PostgreSQL 16 de `infra/docker-compose.yml`, limitado ao loopback na porta
`55432`. O `docker-compose.yml` da raiz pertence ao catálogo legado.

```bash
pnpm infra:up
export DATABASE_URL=postgresql://partsagricola:partsagricola@127.0.0.1:55432/partsagricola
pnpm db:migrate
pnpm db:seed
```

O runner mantém `public.schema_migration`, adquire um lock consultivo e compara
o SHA-256 do arquivo antes de pular uma migration aplicada. Se ocorrer
`MIGRATION_CHECKSUM_MISMATCH`, restaure o arquivo aplicado e crie uma nova
migration numerada; nunca edite o histórico já executado.

## Seeds

O seed é reaplicável e preserva IDs. Ele ativa somente Brasil/BRL, cria 8 tipos
de máquina, 23 marcas, 10 categorias iniciais e as associações conhecidas entre
tipos e marcas. Outros mercados não são habilitados implicitamente.

## Índice do catálogo

A migration `005_catalog_search.sql` mantém `listing.search_text` normalizado
sem acentos, com título, descrição, peça, códigos, marca, modelo e
compatibilidades. Triggers atualizam o documento quando anúncio, código, peça,
modelo ou compatibilidade muda. Índices GIN/trigrama cobrem texto e filtros;
índices parciais cobrem apenas anúncios publicados.

Referências do catálogo usam `active` para desativação lógica. Anúncios aceitam
garantia em meses e agregados de avaliação somente leitura. `exchange_rate`
preserva taxas decimais por par e instante; o preço original em menor unidade
nunca é sobrescrito.

## Chat e moderação

A migration `006_chat_moderation.sql` dá a cada conversa exatamente um contexto
lógico (`LISTING`, `REQUEST`, `PROPOSAL` ou `ORDER`). Mensagens usam
`client_message_id` para idempotência, preservam somente o corpo seguro e mantêm
anexos em `QUARANTINED` até aprovação assíncrona.

O original necessário ao worker fica em `moderation_evidence`, cifrado pela
aplicação e com expiração máxima de sete dias.
`marketplace.purge_expired_moderation_evidence()` remove resíduos vencidos.
Ocorrências ficam em `moderation_flag`; denúncias são únicas por denunciante e
alvo; `moderation_policy` define limiares progressivos e
`moderation_sanction` preserva o histórico por usuário ou empresa.

## Importação CSV

Execute sempre com um caminho explícito:

```bash
pnpm db:import:catalog -- packages/db/fixtures/catalog-example.csv
```

Cabeçalho obrigatório, em UTF-8:

```text
schema_version,source,external_id,part_name,part_code,code_type,brand,category,description,machine_type,machine_brand,machine_model,year_start,year_end
```

- `schema_version` deve ser `1`.
- `source + external_id` identifica a origem de forma idempotente.
- `part_name`, `part_code` e `code_type` são obrigatórios.
- `code_type`: `ORIGINAL`, `EQUIVALENT`, `OEM`, `GTIN` ou `SUPPLIER`.
- Máquina exige tipo, marca e modelo juntos.
- Anos, quando presentes, ficam entre 1900 e 2200 e o final não antecede o
  inicial.

O arquivo inteiro é validado antes do acesso ao banco. A persistência ocorre em
uma única transação: qualquer linha inválida reverte todas as linhas. O exemplo
em `packages/db/fixtures/catalog-example.csv` é seguro para testes locais.

## Testes descartáveis

Os testes exigem uma URL administrativa exclusivamente de teste:

```bash
MARKETPLACE_TEST_ADMIN_URL=postgresql://partsagricola:partsagricola@127.0.0.1:55432/postgres \
  pnpm --filter @partsagricola/db test
```

Cada caso cria um banco com prefixo `partsagricola_test_`, executa o cenário e
remove somente esse banco. Nunca aponte essa variável para produção.

## Regras principais

- somente `company.status = APPROVED` mantém anúncio publicado; trocar o
  anunciante revalida a aprovação e suspender a empresa pausa seus anúncios;
- `company_id` é protegido por chaves estrangeiras compostas nos interesses e
  propostas;
- usuário só representa empresa da qual é membro ativo;
- propostas validam autor, direção e empresa emissora contra o interesse;
- vínculos do catálogo legado validam existência e tipo e protegem a entidade
  vinculada contra exclusão;
- publicação/suspensão e importações concorrentes são serializadas; os locks de
  arquivos com várias linhas seguem ordem canônica para evitar deadlocks;
- contatos permanecem privados por padrão;
- preço é informativo: `bigint` em minor units + moeda ISO, ou sob consulta;
- códigos são normalizados, mas o valor original é preservado;
- busca pública considera somente empresas aprovadas, anúncios publicados e o
  mercado solicitado;
- taxas cambiais são aproximativas, datadas e nunca transformam o preço
  persistido;
- mensagens só podem ser enviadas por participantes da conversa.
- anexos de mensagem não são entregues enquanto estiverem em quarentena.
