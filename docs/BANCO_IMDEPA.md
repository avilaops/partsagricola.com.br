# Catálogo Imdepa — banco de dados

Os 12.502 produtos raspados de `loja.imdepa.com.br` organizados em Postgres,
com schema, migrations e queries prontas para montar catálogo e filtros.

## Subir e carregar

```bash
docker compose up -d db                       # Postgres 16 em localhost:5432

# migrations, na ordem
for f in sql/migrations/00*.sql; do
  docker exec -i catalogo_pg psql -U catalogo -d catalogo_db -v ON_ERROR_STOP=1 < "$f"
done

pip install "psycopg[binary]"
python scripts/load_imdepa.py --truncate      # ~85 s
```

Recarregar depois é só `python scripts/load_imdepa.py` (sem `--truncate`):
a carga é idempotente — atualiza o que mudou, não duplica.

DSN padrão: `postgresql://catalogo:catalogo@localhost:5432/catalogo_db`
(sobrescreva com `--dsn` ou a variável `IMDEPA_DSN`).

## O que entrou

| | |
|---|---|
| Produtos | 12.502 |
| Imagens | 16.921 (1 a 9 por produto; 3 produtos sem foto) |
| Características | 105.046 linhas, ~200 chaves distintas |
| Marcas | 17 (GTOP-GBR, FAG, TIMKEN, SKF, Continental, Sabó…) |
| Categorias | 91, em 3 níveis |
| Máquinas compatíveis | 1.820 modelos, 21.698 vínculos |

## Estrutura

```
product ─┬─ product_image     (foto1..N, position 1 = principal)
         ├─ product_spec      (chave/valor, com value_num p/ faixa)
         └─ product_machine ── machine   (compatibilidade N:N)
brand, category (3 níveis, auto-referente)
```

### Como as características foram organizadas

A fonte tem ~200 chaves técnicas diferentes, e nenhum produto usa todas.
Uma coluna por chave seria uma tabela com 200 colunas quase vazias; só
JSONB tornaria filtro por faixa lento. Então são as três formas ao mesmo
tempo, cada uma para um uso:

1. **Colunas promovidas** — os ~13 atributos que realmente se filtra
   (`diametro_interno_mm`, `diametro_externo_mm`, `largura_mm`,
   `altura_mm`, `peso_kg`, `carga_dinamica_n`, `material`, `tipo`…),
   já convertidos para uma unidade só e com índice B-tree.
2. **`product.spec` (JSONB)** — todas as características cruas, 1:1 com a
   origem. Nada se perde, mesmo o que não virou coluna.
3. **`product_spec`** — as mesmas em chave/valor, com `value_num`
   preenchido quando o valor é numérico. É o que alimenta as facetas
   ("quais valores de *Tipo de Furo* existem e quantos produtos em cada")
   sem precisar criar coluna nova a cada atributo.

### Normalização de unidades

A origem mistura formatos; o loader converte tudo antes de gravar:

| Origem | Vira |
|---|---|
| `35 mm`, `1.1/4"`, `5/8"` | mm (`31.750`, `15.875`) |
| `0,245kg`, `245 g` | kg |
| `25,5 kN`, `18.200 N` | N (`25500`, `18200`) |
| `3.400 rpm com tolerância…` | rpm (`3400`) |

Detalhe que morde: a fonte é pt-BR, então `18.200` é **dezoito mil e
duzentos**, não 18,2. O parser trata ponto como separador de milhar e
vírgula como decimal.

Códigos de barras, NCM e códigos internos ficam **só como texto** — extrair
número deles não serve para filtro e estouraria a escala de `value_num`.

### Views

| View | Para quê |
|---|---|
| `v_produto_listagem` | **grade, busca, filtro, paginação** |
| `v_produto` | ficha do produto (traz arrays de fotos e máquinas) |
| `v_produto_fotos` | formato planilha: `titulo, preco, foto1..foto5, …` |
| `mv_faceta_spec` | sidebar de filtros (materializada) |
| `mv_faixa_dim` | sliders "de X a Y mm" (materializada) |

Use `v_produto_listagem` em qualquer listagem com `ORDER BY`. `v_produto`
tem 4 subconsultas por linha — ótimas para 1 produto, caras para ordenar
12 mil: medido, **908 ms contra 90 ms** na página 40.

Depois de mexer nos dados fora do loader, atualize as materializadas:

```sql
SELECT imdepa.refresh_catalogo();
```

## Busca

Três caminhos, do mais preciso ao mais tolerante:

```sql
-- 1. por código (o caso de balcão: o cliente chega com um número)
SELECT nome, codigo FROM imdepa.product WHERE codigo ILIKE '%6205%';

-- 2. full-text em português, com peso: código > nome > descrição
SELECT titulo, marca FROM imdepa.v_produto_listagem,
     plainto_tsquery('portuguese', imdepa.f_unaccent('rolamento agricola')) q
 WHERE search_tsv @@ q ORDER BY ts_rank(search_tsv, q) DESC;

-- 3. tolerante a erro de digitação ("rolamneto")
SELECT nome FROM imdepa.product
 WHERE imdepa.f_unaccent(nome) % imdepa.f_unaccent('rolamneto');
```

Acento é ignorado nos três (`unaccent`), então "rotula" acha "Rótula".

## Compatibilidade com máquinas

O campo *Aplicação Equipamentos* vinha com JavaScript da loja grudado no
texto. O loader separa o payload real e monta a relação N:N — 1.185
produtos ligados a 1.820 modelos de colheitadeira/trator:

```sql
SELECT p.nome, p.codigo, pm.serial_range
FROM imdepa.machine m
JOIN imdepa.product_machine pm ON pm.machine_id = m.id
JOIN imdepa.product p          ON p.id = pm.product_id
WHERE m.slug = 'john-deere-9750sts';
```

Grafias diferentes da mesma máquina ("CASE IH A8800" e "CASE-IH A8800")
são fundidas pelo slug, senão o filtro mostraria a mesma colheitadeira
duas vezes.

## Ressalvas honestas

**Não há preço.** A loja Imdepa só mostra preço a quem está logado — no
site fica "sob consulta". As colunas `price` / `currency` existem e
`price_on_request` está `TRUE` em todos os 12.502 itens: quando houver
tabela de preço própria, é só preencher. `v_produto_fotos.preco` mostra
`'Sob consulta'` até lá.

**Cobertura de medidas é parcial**, e varia muito por departamento:

| Departamento | Produtos | Com medida | Com foto |
|---|---|---|---|
| Rolamentos | 7.038 | 2.438 | 100% |
| Correias | 2.083 | 0 | 100% |
| Retentores | 1.235 | 442 | 100% |

Correias, Correntes, Embreagens e Vedações não têm diâmetro nenhum na
origem — para esses o filtro dimensional não serve, use as facetas
(`mv_faceta_spec`) e a busca textual. A query 14 do arquivo de queries
mostra a cobertura completa por departamento.

A migration 003 melhora bastante a largura: a tabela técnica quase nunca
traz "Largura", mas o título traz (`35 mm x 62 mm x 14 mm`). Extrair dali
leva a cobertura de **760 para 3.514** produtos. A coluna
`medidas_do_titulo` marca quem veio por esse caminho — a informação
declarada pela fonte sempre tem precedência.

## Arquivos

| Arquivo | O que é |
|---|---|
| `sql/migrations/001_imdepa_schema.sql` | tabelas, índices, busca |
| `sql/migrations/002_imdepa_views.sql` | views e materializadas |
| `sql/migrations/003_imdepa_medidas_do_titulo.sql` | medidas a partir do título |
| `sql/migrations/004_imdepa_view_listagem.sql` | view enxuta de listagem |
| `sql/queries_imdepa.sql` | 15 consultas prontas, cada uma um endpoint |
| `scripts/load_imdepa.py` | ETL idempotente |

O schema `imdepa` é separado do schema `catalogo` (catálogos Geomaq /
vedação) — mesmo banco, sem misturar as fontes.

## Exportar para planilha

```bash
docker exec catalogo_pg psql -U catalogo -d catalogo_db \
  -c "\copy (SELECT * FROM imdepa.v_produto_fotos ORDER BY titulo) \
      TO STDOUT CSV HEADER" > catalogo_imdepa.csv
```
