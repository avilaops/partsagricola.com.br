# Catálogo de referências e busca

O catálogo da PARTSAGRICOLA normaliza tipos de máquina, marcas, modelos,
categorias, peças, códigos e compatibilidades. Ele ajuda empresas anunciantes
a descrever ofertas e compradores a encontrá-las. Uma referência não representa
estoque, propriedade ou venda da plataforma; somente um `listing` publicado por
uma empresa aprovada aparece na busca.

## API pública

As leituras não exigem login e respeitam o mercado resolvido por hostname,
`market` ou `x-market`:

| Rota                                             | Uso                                                |
| ------------------------------------------------ | -------------------------------------------------- |
| `GET /v1/catalog/machine-types`                  | Tipos ativos de máquina                            |
| `GET /v1/catalog/brands?machineTypeId=`          | Marcas, opcionalmente por tipo                     |
| `GET /v1/catalog/models?brandId=&machineTypeId=` | Modelos para a busca guiada                        |
| `GET /v1/catalog/years?modelId=`                 | Anos cobertos pelo modelo                          |
| `GET /v1/catalog/categories`                     | Categorias ativas                                  |
| `GET /v1/catalog/parts/:code`                    | Todas as peças para um código original/equivalente |
| `GET /v1/catalog/compatibilities?partId=`        | Aplicações de uma peça                             |
| `GET /v1/catalog/search`                         | Busca unificada e paginada de anúncios             |

A busca normaliza caixa e acentos, usa texto completo e trigramas para tolerar
pequenos erros, e consulta nome, código, marca, modelo e aplicação. Os filtros
são `machineTypeId`, `brandId`, `modelId`, `year`, `categoryId`, `condition`,
`state`, `city`, `priceMin`, `priceMax` e `hasWarranty`. As ordenações são
`RELEVANCE`, `PRICE_ASC`, `NEWEST` e `RATING`; cursores incluem desempates para
paginação estável.

Preços são inteiros na menor unidade monetária. `displayCurrency` solicita uma
conversão aproximada pela taxa administrativa vigente. A resposta informa
`approximate: true` e `rateEffectiveAt`. Sem taxa, o sistema não inventa valor:
o preço convertido fica ausente e o anúncio não participa de filtro/ordenação
na moeda solicitada.

## Administração

`ADMIN` e `SUPPORT` podem listar, criar, alterar e desativar as entidades em
`/v1/admin/catalog/:entity`. `FINANCE` e usuários comuns não recebem acesso. As
entidades permitidas são `machine-types`, `brands`, `brand-associations`,
`models`, `categories`, `parts`, `codes`, `compatibilities` e `exchange-rates`.
O nome da tabela nunca vem diretamente da requisição: a API usa um mapa fechado.
Toda mutação bem-sucedida grava ator, mercado, IP, entidade e diff na auditoria.

O painel fica em `/administracao/catalogo`. A sessão permanece no cookie
HttpOnly e as chamadas à API ocorrem no servidor. O parâmetro `evidence=1` usa
dados determinísticos somente quando `NODE_ENV` não é `production`; ele não
contorna autenticação em produção.

## Importação CSV

`POST /v1/admin/catalog/imports` recebe `{ "csv": "..." }`. O parser valida o
arquivo inteiro antes da transação. Uma linha inválida desfaz todo o lote; nenhum
registro ou auditoria parcial é persistido. Importações repetidas reativam
referências desativadas e preservam a rastreabilidade do catálogo histórico. O
contrato de colunas está em [Banco do marketplace](BANCO-MARKETPLACE.md).

## Banco e desempenho

A migration `005_catalog_search.sql` instala `unaccent`, associações entre tipo
e marca, soft delete, garantia, avaliações agregadas, taxas de câmbio, vetor de
busca atualizado por trigger e índices GIN/trigram/B-tree. Apenas empresas
aprovadas e anúncios `PUBLISHED` com referências ativas são públicos.

Para reproduzir a aceitação de 100 mil anúncios no PostgreSQL 16:

```bash
docker compose -f infra/docker-compose.yml up -d --wait postgres
MARKETPLACE_TEST_ADMIN_URL=postgresql://partsagricola:partsagricola@127.0.0.1:55432/postgres \
  pnpm --filter @partsagricola/db test
```

O teste aquece a consulta três vezes, mede dez execuções pelo `Execution Time`
do PostgreSQL e exige p95 inferior a 300 ms. Os dados são determinísticos e o
banco de teste é recriado por execução.

## Validação visual

- [Administração desktop](evidencias/avl-171/catalog-admin-desktop.png)
- [Administração mobile](evidencias/avl-171/catalog-admin-mobile.png)

Os testes Playwright cobrem busca local, criação, edição, desativação,
erro/sucesso de CSV, foco por teclado e ausência de overflow em 320 px.
