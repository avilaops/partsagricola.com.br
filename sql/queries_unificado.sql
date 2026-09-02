-- =====================================================================
--  Catálogo unificado — consultas prontas
--
--  A ideia central: o cliente busca uma MEDIDA e vê o que serve, de
--  todos os fornecedores. Fornecedor é atributo (uma coluna a mais na
--  resposta), não uma divisória entre catálogos separados.
--
--    docker exec -i catalogo_pg psql -U catalogo -d catalogo_db \
--        -f sql/queries_unificado.sql
-- =====================================================================
SET search_path TO imdepa, catalogo, public;

-- ---------------------------------------------------------------------
-- 1. O QUE MUDA — a mesma busca, antes e depois
--
--    Antes: para achar um retentor de eixo 30 o cliente tinha que saber
--    o fornecedor, porque o campo mudava de nome em cada fonte
--    (eixo_mm / interno_mm / "Diâmetro Interno") e a busca do site
--    comparava por igualdade exata.
--
--    Agora: uma medida, todos os fornecedores, ordenado por quem tem
--    a peça mais próxima do pedido.
-- ---------------------------------------------------------------------
SELECT fornecedor, marca, codigo, interno_mm, externo_mm, altura_mm
FROM v_item
WHERE tipo_slug = 'retentor'
  AND interno_mm BETWEEN 30 - 0.5 AND 30 + 0.5
  AND externo_mm BETWEEN 47 - 0.5 AND 47 + 0.5
ORDER BY fornecedor, marca
LIMIT 20;

-- ---------------------------------------------------------------------
-- 2. "TENHO ESTA PEÇA — QUEM MAIS FORNECE?"
--    A pergunta do balcão quando o item preferido está em falta.
--    Só devolve outros fornecedores, ordenado pela diferença de medida
--    (0.000 = medida idêntica).
-- ---------------------------------------------------------------------
SELECT codigo, nome, fornecedor, marca,
       interno_mm, externo_mm, altura_mm, diferenca
FROM imdepa.equivalentes(7907)      -- troque pelo id do item
LIMIT 10;

-- tolerância maior, quando não há nada exato (aceita 1 mm de folga)
SELECT codigo, fornecedor, interno_mm, externo_mm, altura_mm, diferenca
FROM imdepa.equivalentes(7907, 1.0)
LIMIT 10;

-- ---------------------------------------------------------------------
-- 3. BUSCA POR MEDIDA SEM SABER O TIPO
--    "furo 25, externo 35" — devolve retentor, gaxeta, rolamento…
--    agrupado por tipo, para o cliente escolher o que procura.
-- ---------------------------------------------------------------------
SELECT tipo, fornecedor, count(*) AS opcoes
FROM v_item
WHERE interno_mm BETWEEN 25 - 0.5 AND 25 + 0.5
  AND externo_mm BETWEEN 35 - 0.5 AND 35 + 0.5
GROUP BY tipo, fornecedor
ORDER BY opcoes DESC;

-- ---------------------------------------------------------------------
-- 4. O-RING — o único tipo que não usa externo/altura.
--    Define-se por diâmetro interno + seção; a coluna secao_mm existe
--    só para ele (ver tipo_peca.usa_secao, que guia a UI do filtro).
-- ---------------------------------------------------------------------
SELECT fornecedor, marca, codigo, interno_mm, secao_mm
FROM v_item
WHERE tipo_slug = 'o-ring'
  AND interno_mm BETWEEN 10 - 0.3 AND 10 + 0.3
ORDER BY secao_mm NULLS LAST
LIMIT 15;

-- ---------------------------------------------------------------------
-- 5. BUSCA POR CÓDIGO — o cliente chega com o número na mão.
--    codigo_norm é maiúsculo e sem pontuação, então "ag-7705", "AG7705"
--    e "ag 7705" caem no mesmo lugar.
-- ---------------------------------------------------------------------
-- exata: a aplicação manda o termo já normalizado (maiúsculo, só
-- alfanumérico) — é a mesma regra do cod_norm() do unificar_catalogo.py
SELECT i.codigo, i.nome, f.nome AS fornecedor, i.marca,
       i.interno_mm, i.externo_mm
FROM item i JOIN fornecedor f ON f.id = i.fornecedor_id
WHERE i.codigo_norm = upper(regexp_replace('ag-7705', '[^A-Za-z0-9]', '', 'g'))
LIMIT 10;

-- parcial (o cliente lembra parte do código)
SELECT i.codigo, i.nome, f.nome AS fornecedor
FROM item i JOIN fornecedor f ON f.id = i.fornecedor_id
WHERE i.codigo_norm LIKE '%7705%'
LIMIT 10;

-- ---------------------------------------------------------------------
-- 6. BUSCA TEXTUAL cruzando fornecedores
-- ---------------------------------------------------------------------
SELECT nome, fornecedor, marca, codigo
FROM v_item, plainto_tsquery('portuguese', imdepa.f_unaccent('retentor sabo')) q
WHERE search_tsv @@ q
ORDER BY ts_rank(search_tsv, q) DESC
LIMIT 15;

-- ---------------------------------------------------------------------
-- 7. COBERTURA — onde a unificação funciona e onde não funciona.
--    Honestidade sobre o dado: só filtra por medida quem tem medida.
-- ---------------------------------------------------------------------
SELECT fornecedor,
       count(*)                                        AS itens,
       count(*) FILTER (WHERE interno_mm IS NOT NULL)  AS com_medida,
       round(100.0 * count(*) FILTER (WHERE interno_mm IS NOT NULL)
             / count(*), 1)                            AS pct
FROM v_item
GROUP BY fornecedor
ORDER BY itens DESC;

-- quais TIPOS existem em mais de um fornecedor (onde a equivalência
-- entre fornecedores é possível de fato)
SELECT tipo,
       count(DISTINCT fornecedor)                      AS fornecedores,
       count(*) FILTER (WHERE interno_mm IS NOT NULL)  AS com_medida
FROM v_item
WHERE tipo IS NOT NULL
GROUP BY tipo
HAVING count(DISTINCT fornecedor) > 1
ORDER BY com_medida DESC;

-- ---------------------------------------------------------------------
-- 8. QUANTOS ITENS TÊM ALTERNATIVA EM OUTRO FORNECEDOR
--    A medida do valor entregue por esta camada.
-- ---------------------------------------------------------------------
SELECT count(*) AS itens_com_alternativa
FROM item i
WHERE i.interno_mm IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM item o
       WHERE o.id <> i.id
         AND o.fornecedor_id <> i.fornecedor_id
         AND o.tipo_id IS NOT DISTINCT FROM i.tipo_id
         AND o.interno_mm BETWEEN i.interno_mm - 0.5 AND i.interno_mm + 0.5
         AND (i.externo_mm IS NULL
              OR o.externo_mm BETWEEN i.externo_mm - 0.5 AND i.externo_mm + 0.5)
  );
