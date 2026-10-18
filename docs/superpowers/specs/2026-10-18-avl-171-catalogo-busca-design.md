# AVL-171 — Catálogo universal e busca

## Intenção

Entregar o domínio pesquisável que sustenta o marketplace B2B sem transformar a PARTSAGRICOLA em lojista. Empresas aprovadas publicam anúncios vinculados a peças ou máquinas; compradores encontram esses anúncios por texto, código e compatibilidade. A plataforma apresenta e conecta as partes, sem carrinho, checkout ou venda própria.

## Objetivos

- Expor referências públicas de tipos de máquina, marcas, modelos, anos, categorias, peças, códigos e compatibilidades.
- Oferecer busca pública unificada, tolerante a acentos e pequenos erros, com filtros e ordenações do AVL-171.
- Permitir a busca guiada por tipo, marca, modelo e ano.
- Oferecer a administradores CRUD auditado das referências e importação CSV transacional.
- Converter valores apenas para exibição quando a moeda solicitada diferir da moeda do anúncio, identificando-os como aproximados.
- Demonstrar que `bomba hidraulica mf 290` encontra um anúncio compatível com Massey Ferguson MF 290.
- Demonstrar tempo de consulta inferior a 300 ms em PostgreSQL 16 com 100 mil anúncios publicados.

## Não objetivos

- Não criar carrinho, checkout, estoque próprio, pedido, pagamento ou cálculo de frete.
- Não implementar a home pública e a página final do anúncio; isso pertence ao AVL-173.
- Não cadastrar ou aprovar fornecedores; isso pertence ao AVL-172.
- Não consumir um provedor cambial externo neste módulo. Taxas são dados administrativos com data de referência.
- Não publicar ou implantar em produção.

## Arquitetura

### Banco

A migration `005_catalog_search.sql` amplia o domínio incremental existente. Ela habilita `unaccent`, cria uma função imutável de normalização, associa marcas aos tipos de máquina, adiciona `warranty_months` e avaliação agregada nos anúncios e cria uma tabela de taxas cambiais. Uma coluna de documento de busca mantida por trigger reúne título, peça, códigos, marca, modelo e compatibilidade. Índices GIN/trigrama e índices de filtros mantêm a consulta seletiva. `warranty_months` é nulo quando não informada e inteiro de 0 a 120 quando declarada; `hasWarranty=true` exige valor maior que zero.

Todas as referências mutáveis (`machine_type`, `brand`, associação tipo–marca, `machine_model`, `part_category`, `part`, `part_code` e `part_fitment`) usam desativação lógica. Itens inativos não aparecem nas rotas públicas. O importador reativa a identidade importada em vez de criar duplicata. Nenhuma referência utilizada é apagada em cascata.

A seed de desempenho separado e determinístico gera 100 mil anúncios apenas no banco descartável de teste. Ele não integra o seed operacional nem produção.

### API

O módulo de catálogo deixa de ser um placeholder genérico e ganha rotas próprias sob `/v1/catalog`:

- `GET /v1/catalog/machine-types`
- `GET /v1/catalog/brands?machineTypeId=`
- `GET /v1/catalog/models?brandId=&machineTypeId=`
- `GET /v1/catalog/years?modelId=`
- `GET /v1/catalog/categories`
- `GET /v1/catalog/parts/:code`
- `GET /v1/catalog/compatibilities?partId=`
- `GET /v1/catalog/search`

A busca aceita `q`, tipo, marca, modelo, ano, categoria, condição, UF, cidade, preço mínimo/máximo, garantia, moeda de exibição, ordenação, cursor e limite. Os valores de ordenação são `RELEVANCE`, `PRICE_ASC`, `NEWEST` e `RATING`. O padrão é `RELEVANCE` quando há texto e `NEWEST` quando não há. O cursor opaco carrega as chaves da ordenação e o ID para paginação estável.

Só entram anúncios `PUBLISHED`, de empresas `APPROVED` e pertencentes ao mercado resolvido por `market`, `X-Market` ou hostname também para chamadas anônimas. A relevância combina correspondência de código, texto normalizado e similaridade; empates têm ordenação estável por ID. Filtros de preço operam na `displayCurrency`, ou na moeda padrão do mercado quando omitida. Anúncios sob consulta são excluídos quando há faixa de preço ou `PRICE_ASC`; anúncios sem taxa válida para a moeda alvo também são excluídos nesses casos.

Cada resultado público contém ID e tipo do anúncio, título, condição, garantia, localização, data de publicação, imagem principal, empresa pública (`id`, nome fantasia e selo de verificação), peça/máquina associada, códigos públicos, compatibilidades resumidas, rating agregado e bloco de preço original/convertido. `GET /parts/:code` devolve uma lista, porque o mesmo código pode representar peças diferentes; a resposta nunca escolhe uma peça arbitrariamente.

Rotas administrativas ficam sob `/v1/admin/catalog`, exigem papel `ADMIN` ou `SUPPORT`, validam todos os corpos com Zod e registram auditoria. O CRUD cobre tipos de máquina, marcas, associações tipo–marca, modelos, categorias, peças, códigos, compatibilidades e taxas cambiais. A ação de exclusão desativa a entidade. A importação recebe CSV como texto em JSON, reutiliza o parser e a transação idempotente existentes, e devolve o resumo.

O acesso PostgreSQL fica em um repositório dedicado e injetável. Testes de contrato da API usam repositório em memória; testes de integração exercitam SQL real.

### Conversão monetária

`exchange_rate` guarda moeda de origem, destino, razão decimal e `effective_at`, com unicidade por par e instante. A busca usa a taxa mais recente não futura. O valor original nunca é substituído. Quando há conversão, a resposta inclui o valor original, o valor convertido, a moeda solicitada, `approximate: true` e a data da taxa. Sem taxa válida, mantém o preço original e não inventa conversão.

`rating_average` e `rating_count` são agregados somente leitura neste módulo, começam em zero e não têm endpoint administrativo de escrita. O AVL-181 será responsável por recalculá-los a partir das avaliações.

### Administração e evidência visual

`/administracao/catalogo` apresenta painel responsivo com busca, filtros, tabela de referências, formulários de criação/edição, ação de arquivar/desativar e importação CSV. Um route handler interno lê o cookie HttpOnly e encaminha chamadas autenticadas para a API, evitando expor o token ao JavaScript.

Os testes Playwright usam dados determinísticos no modo de evidência para validar filtros, formulário, importação, ausência de overflow em 320 px e gerar prints desktop/mobile. A funcionalidade real permanece coberta pela API e PostgreSQL; o modo de evidência não finge persistência de produção.

## Segurança e invariantes

- Busca pública nunca retorna rascunhos, suspensos ou dados internos do anunciante.
- Mutação administrativa falha fechada sem autenticação ou papel permitido.
- IDs, enums, limites, CSV e moedas são validados antes do repositório.
- SQL usa parâmetros; nomes de tabela não vêm da entrada HTTP.
- Importação inteira é atômica e mantém os locks canônicos existentes.
- Exclusão é conservadora: referências usadas são desativadas ou rejeitadas por FK, nunca apagadas em cascata.
- Preços permanecem inteiros na menor unidade e conversões usam `numeric`, nunca ponto flutuante persistido.

## Critérios de homologação

1. Todos os endpoints aparecem no OpenAPI e no cliente gerado.
2. Testes de API cobrem navegação, busca, filtros, ordenação, autorização, CRUD, CSV e conversão.
3. Testes PostgreSQL comprovam busca sem acento/erro, código original/equivalente, compatibilidade e isolamento de status.
4. Benchmark SQL repetível cria 100 mil anúncios, aquece a consulta três vezes, mede dez execuções com `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` e falha quando o p95 de `Execution Time` excede 300 ms. O gate roda no PostgreSQL 16 do CI.
5. Playwright desktop/mobile valida o painel e produz as evidências em `docs/evidencias/avl-171/`.
6. Lint, formatação, typecheck, testes, cliente OpenAPI e build passam no monorepo e no GitHub Actions.

## Decisões do executor

- PostgreSQL é a fonte de busca; não será introduzido Elasticsearch antes de haver necessidade medida.
- A busca é pública, porque o catálogo do marketplace precisa ser descoberto sem login; escrita é administrativa e autenticada.
- `ADMIN` e `SUPPORT` podem manter catálogo; `FINANCE` não pode alterá-lo.
- A branch do AVL-171 é empilhada sobre `avl-170-design-system-compartilhado`, pois reutiliza o design system ainda não mesclado.
- Haverá apenas um commit e um push após implementação, testes e prints completos, conforme a regra do projeto.
