-- =====================================================================
--  Catálogo Imdepa — consultas prontas
--
--  Cada bloco é uma query independente, pensada para virar endpoint.
--  Os :placeholders são do psql (\set) — num app, troque por $1, $2...
--
--  Uso rápido:
--    docker exec -i catalogo_pg psql -U catalogo -d catalogo_db \
--        -f sql/queries_imdepa.sql
-- =====================================================================
SET search_path TO imdepa, catalogo, public;

-- ---------------------------------------------------------------------
-- 1. LISTAGEM — grade do catálogo (título, preço, fotos, principais specs)
--    Formato "planilha": foto1..foto5 em colunas.
-- ---------------------------------------------------------------------
SELECT titulo, preco, foto1, foto2, marca, modelo,
       diametro_interno, diametro_externo, largura, utilizacao
FROM v_produto_fotos
ORDER BY titulo
LIMIT 20;

-- 1b. LISTAGEM PAGINADA — use v_produto_listagem sempre que houver
--     ORDER BY + LIMIT/OFFSET. Ela evita as subconsultas por linha de
--     v_produto (medido: 90 ms contra 908 ms na página 40).
SELECT titulo, marca, departamento, foto_principal
FROM v_produto_listagem
ORDER BY titulo
LIMIT 50 OFFSET 2000;

-- ---------------------------------------------------------------------
-- 2. BUSCA TEXTUAL — full-text em português, com ranking.
--    Pesos: código (A) > nome (B) > descrição (C), então buscar "6205"
--    traz o rolamento 6205 antes de qualquer texto que só cite o número.
-- ---------------------------------------------------------------------
SELECT titulo, marca, codigo, categoria,
       ts_rank(search_tsv, q) AS relevancia, foto_principal
FROM v_produto_listagem, plainto_tsquery('portuguese', f_unaccent('rolamento agricola')) q
WHERE search_tsv @@ q
ORDER BY relevancia DESC, titulo
LIMIT 20;

-- ---------------------------------------------------------------------
-- 3. BUSCA TOLERANTE A ERRO DE DIGITAÇÃO (trigrama)
--    Para quando o full-text não acha nada: "rolamneto", "cerreia".
-- ---------------------------------------------------------------------
SELECT nome AS titulo, codigo, similarity(f_unaccent(nome), f_unaccent('rolamneto')) AS sim
FROM product
WHERE f_unaccent(nome) % f_unaccent('rolamneto')
ORDER BY sim DESC
LIMIT 10;

-- ---------------------------------------------------------------------
-- 4. BUSCA POR CÓDIGO (fabricante, Imdepa, montadora ou barras)
--    O caso mais comum no balcão: o cliente chega com um número.
-- ---------------------------------------------------------------------
SELECT nome AS titulo, codigo, codigo_imdepa, codigo_montadora, gtin
FROM product
WHERE codigo ILIKE '%6205%'
   OR codigo_imdepa ILIKE '%6205%'
   OR codigo_montadora ILIKE '%6205%'
   OR gtin = '6205'
LIMIT 20;

-- ---------------------------------------------------------------------
-- 5. FILTRO POR MEDIDA — o filtro clássico de rolamento.
--    "Preciso de um rolamento com furo 35mm e externo 62mm."
--    Tolerância de ±0,5mm porque a fonte arredonda.
--
--    ATENÇÃO à cobertura: a tabela técnica da fonte quase nunca traz
--    "Largura". A migration 003 recupera a medida do título ("35 mm x
--    62 mm x 14 mm") e leva a cobertura de 760 para 3.514 produtos —
--    mas ainda são 3.514 de 12.502. Por isso o filtro de largura entra
--    como opcional (IS NULL OR ...): exigi-lo esconderia a maior parte
--    do catálogo. Ver query 14 para a cobertura por departamento.
-- ---------------------------------------------------------------------
SELECT titulo, marca, codigo,
       diametro_interno_mm AS di, diametro_externo_mm AS de, largura_mm AS lg,
       foto_principal
FROM v_produto_listagem
WHERE departamento = 'Rolamentos'
  AND diametro_interno_mm BETWEEN 35 - 0.5 AND 35 + 0.5
  AND diametro_externo_mm BETWEEN 62 - 0.5 AND 62 + 0.5
  -- largura só restringe quem a declara
  AND (largura_mm IS NULL OR largura_mm BETWEEN 18 - 0.5 AND 18 + 0.5)
ORDER BY marca, codigo;

-- ---------------------------------------------------------------------
-- 6. FILTRO POR FAIXA + marca + categoria (a query da tela de catálogo)
-- ---------------------------------------------------------------------
SELECT titulo, marca, categoria, diametro_interno_mm, peso_kg, foto_principal
FROM v_produto_listagem
WHERE departamento = 'Rolamentos'
  AND marca = ANY (ARRAY['SKF', 'FAG'])
  AND diametro_interno_mm BETWEEN 20 AND 60
  AND (aplicacao IS NULL OR aplicacao = 'Agrícola')
ORDER BY diametro_interno_mm, titulo
LIMIT 50;

-- ---------------------------------------------------------------------
-- 7. COMPATIBILIDADE — "quais peças servem na minha máquina?"
--    O filtro mais valioso do catálogo agrícola.
-- ---------------------------------------------------------------------
SELECT m.full_name AS maquina, p.nome AS titulo, p.codigo,
       b.name AS marca, pm.serial_range AS faixa_serie
FROM machine m
JOIN product_machine pm ON pm.machine_id = m.id
JOIN product p          ON p.id = pm.product_id
LEFT JOIN brand b       ON b.id = p.brand_id
WHERE m.slug = 'john-deere-9750sts'
ORDER BY b.name, p.codigo;

-- ---------------------------------------------------------------------
-- 8. AUTOCOMPLETE de máquina (para o seletor "escolha seu equipamento")
-- ---------------------------------------------------------------------
SELECT m.full_name, m.maker, count(pm.product_id)::int AS qtd_pecas
FROM machine m
LEFT JOIN product_machine pm ON pm.machine_id = m.id
WHERE f_unaccent(m.full_name) ILIKE f_unaccent('%john deere%')
GROUP BY m.id
ORDER BY qtd_pecas DESC
LIMIT 15;

-- ---------------------------------------------------------------------
-- 9. FACETAS — sidebar de filtros de um departamento.
--    Lê a materialized view, não varre os 12k produtos.
-- ---------------------------------------------------------------------
SELECT attr_key, attr_value, qtd
FROM mv_faceta_spec
WHERE departamento = 'Rolamentos'
  AND attr_slug = 'tipo-de-furo'
ORDER BY qtd DESC;

-- os 12 atributos mais úteis para filtrar dentro de um departamento
-- (mais valores distintos = mais poder de filtro, mas nem tanto que vire ruído)
SELECT attr_key,
       count(DISTINCT attr_value) AS valores_distintos,
       sum(qtd)                   AS produtos
FROM mv_faceta_spec
WHERE departamento = 'Rolamentos'
GROUP BY attr_key
HAVING count(DISTINCT attr_value) BETWEEN 2 AND 40
ORDER BY produtos DESC
LIMIT 12;

-- ---------------------------------------------------------------------
-- 10. SLIDERS — faixa de cada dimensão por departamento
-- ---------------------------------------------------------------------
SELECT departamento, qtd_produtos, di_min, di_max, de_min, de_max,
       lg_min, lg_max, peso_min, peso_max
FROM mv_faixa_dim
ORDER BY qtd_produtos DESC;

-- ---------------------------------------------------------------------
-- 11. FICHA DO PRODUTO — tudo de um item (specs em linhas, para tabela)
-- ---------------------------------------------------------------------
SELECT p.nome AS titulo, b.name AS marca, p.codigo, p.descricao,
       s.attr_key AS caracteristica, s.attr_value AS valor
FROM product p
LEFT JOIN brand b      ON b.id = p.brand_id
LEFT JOIN product_spec s ON s.product_id = p.id
WHERE p.product_id = '10053669'
ORDER BY s.attr_key;

-- fotos do mesmo produto, em ordem
SELECT position, url
FROM product_image
WHERE product_id = (SELECT id FROM product WHERE product_id = '10053669')
ORDER BY position;

-- ---------------------------------------------------------------------
-- 12. FILTRO POR ATRIBUTO NÃO PROMOVIDO (via JSONB)
--     Qualquer uma das ~200 características, sem precisar de coluna nova.
-- ---------------------------------------------------------------------
SELECT nome AS titulo, codigo, spec->>'Tipo de Furo' AS tipo_furo
FROM product
WHERE spec @> '{"Tipo de Furo": "Cilíndrico"}'
LIMIT 20;

-- e por FAIXA num atributo não promovido, usando product_spec.value_num
SELECT p.nome AS titulo, s.attr_value AS angulo
FROM product p
JOIN product_spec s ON s.product_id = p.id
WHERE s.attr_slug = 'angulo-de-contato'
  AND s.value_num BETWEEN 10 AND 30
LIMIT 20;

-- ---------------------------------------------------------------------
-- 13. PRODUTOS SEMELHANTES ("quem viu isto também viu")
--     Mesma categoria e medidas próximas — bom para a ficha do produto.
-- ---------------------------------------------------------------------
WITH alvo AS (
    SELECT category_id, diametro_interno_mm di, diametro_externo_mm de, id
    FROM product WHERE product_id = '10053669'
)
SELECT p.nome AS titulo, b.name AS marca, p.diametro_interno_mm, p.diametro_externo_mm
FROM alvo a
JOIN product p    ON p.category_id = a.category_id AND p.id <> a.id
LEFT JOIN brand b ON b.id = p.brand_id
WHERE abs(coalesce(p.diametro_interno_mm, -999) - coalesce(a.di, -999)) <= 5
ORDER BY abs(p.diametro_interno_mm - a.di) NULLS LAST
LIMIT 10;

-- ---------------------------------------------------------------------
-- 14. PAINEL / QA — cobertura de dados por departamento
--     Mostra onde o catálogo está pobre (sem foto, sem medida).
-- ---------------------------------------------------------------------
SELECT departamento,
       count(*)                                            AS produtos,
       count(*) FILTER (WHERE foto_principal IS NOT NULL)  AS com_foto,
       count(*) FILTER (WHERE diametro_interno_mm IS NOT NULL) AS com_medida,
       count(*) FILTER (WHERE maquinas IS NOT NULL)        AS com_maquina,
       round(100.0 * count(*) FILTER (WHERE foto_principal IS NOT NULL)
             / count(*), 1)                                AS pct_foto
FROM v_produto
GROUP BY departamento
ORDER BY produtos DESC;

-- ---------------------------------------------------------------------
-- 15. EXPORTAR o catálogo em formato planilha (título, preço, fotos...)
--     \copy roda no cliente: o CSV sai na SUA máquina, não no container.
-- ---------------------------------------------------------------------
-- \copy (SELECT * FROM imdepa.v_produto_fotos ORDER BY titulo) TO 'catalogo_imdepa.csv' CSV HEADER
