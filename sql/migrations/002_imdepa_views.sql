-- =====================================================================
--  002 — Views de catálogo
--
--  v_produto        : produto achatado, pronto para listagem/ficha.
--  v_produto_fotos  : foto1..foto5 em colunas (formato "planilha" pedido).
--  mv_faceta_spec   : contagem por (categoria, atributo, valor) — alimenta
--                     a sidebar de filtros sem varrer a tabela toda.
--  mv_faixa_dim     : min/max de cada dimensão por categoria — alimenta
--                     os sliders de faixa.
-- =====================================================================
-- catalogo entra no path porque unaccent/pg_trgm foram instalados lá (schema.sql original)
SET search_path TO imdepa, catalogo, public;

-- ---------------------------------------------------------------------
-- Produto achatado (marca, categorias 1..3, foto principal, nº de fotos)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_produto AS
SELECT
    p.id,
    p.product_id,
    p.nome                       AS titulo,
    p.codigo,
    p.codigo_imdepa,
    p.gtin,
    p.ncm,
    b.name                       AS marca,
    -- categoria em 3 níveis, subindo a árvore a partir da mais específica
    coalesce(c3.name, c2.name, c1.name)                       AS categoria,
    coalesce(c1.name, c2.name, c3.name)                       AS departamento,
    CASE WHEN c3.id IS NOT NULL THEN c2.name
         WHEN c2.id IS NOT NULL THEN c1.name END              AS subcategoria,
    -- preço (hoje sempre sob consulta — ver comentário na migration 001)
    p.price, p.currency, p.price_on_request,
    -- características principais
    p.diametro_interno_mm, p.diametro_externo_mm,
    p.largura_mm, p.altura_mm, p.comprimento_mm, p.espessura_mm,
    p.peso_kg, p.carga_dinamica_n, p.carga_estatica_n,
    p.velocidade_limite_rpm,
    p.material, p.tipo, p.vedacao,
    p.aplicacao, p.utilizacao,
    p.descricao,
    -- todas as demais características
    p.spec,
    -- imagens
    (SELECT i.url FROM product_image i
      WHERE i.product_id = p.id AND i.position = 1)            AS foto_principal,
    (SELECT count(*) FROM product_image i WHERE i.product_id = p.id) AS qtd_fotos,
    (SELECT array_agg(i.url ORDER BY i.position)
       FROM product_image i WHERE i.product_id = p.id)         AS fotos,
    -- máquinas compatíveis
    (SELECT array_agg(m.full_name ORDER BY m.full_name)
       FROM product_machine pm JOIN machine m ON m.id = pm.machine_id
      WHERE pm.product_id = p.id)                              AS maquinas,
    p.url,
    p.search_tsv
FROM product p
LEFT JOIN brand b     ON b.id = p.brand_id
LEFT JOIN category c  ON c.id = p.category_id
-- desdobra a árvore conforme o nível da categoria atribuída
LEFT JOIN category c3 ON c3.id = c.id AND c.level = 3
LEFT JOIN category c2 ON c2.id = CASE c.level WHEN 3 THEN c.parent_id WHEN 2 THEN c.id END
LEFT JOIN category c1 ON c1.id = CASE c.level
                                    WHEN 3 THEN (SELECT parent_id FROM category WHERE id = c.parent_id)
                                    WHEN 2 THEN c.parent_id
                                    WHEN 1 THEN c.id END;

-- ---------------------------------------------------------------------
-- Fotos em colunas — o formato "Titulo, Preço, foto1, f2, ..." pedido.
-- Até 5; produtos com mais mantêm todas em v_produto.fotos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_produto_fotos AS
SELECT
    p.id,
    p.product_id,
    p.nome AS titulo,
    CASE WHEN p.price_on_request THEN 'Sob consulta'
         ELSE to_char(p.price, 'FM999G999G990D00') END AS preco,
    max(CASE WHEN i.position = 1 THEN i.url END) AS foto1,
    max(CASE WHEN i.position = 2 THEN i.url END) AS foto2,
    max(CASE WHEN i.position = 3 THEN i.url END) AS foto3,
    max(CASE WHEN i.position = 4 THEN i.url END) AS foto4,
    max(CASE WHEN i.position = 5 THEN i.url END) AS foto5,
    b.name AS marca,
    p.codigo AS modelo,
    p.diametro_interno_mm AS diametro_interno,
    p.diametro_externo_mm AS diametro_externo,
    p.largura_mm          AS largura,
    p.aplicacao           AS utilizacao,
    p.spec                AS caracteristicas
FROM product p
LEFT JOIN product_image i ON i.product_id = p.id
LEFT JOIN brand b         ON b.id = p.brand_id
GROUP BY p.id, b.name;

-- ---------------------------------------------------------------------
-- Facetas: quantos produtos por (departamento, atributo, valor).
-- MATERIALIZED porque a sidebar de filtro é lida a cada request e os
-- dados só mudam quando o scraper roda.
-- ---------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_faceta_spec;
CREATE MATERIALIZED VIEW mv_faceta_spec AS
SELECT
    root.id            AS departamento_id,
    root.name          AS departamento,
    s.attr_key,
    s.attr_slug,
    s.attr_value,
    count(*)::int      AS qtd
FROM product_spec s
JOIN product p   ON p.id = s.product_id
JOIN category c  ON c.id = p.category_id
JOIN LATERAL (
    -- sobe até a raiz (nível 1) seja qual for o nível da categoria
    SELECT r.id, r.name FROM category r
     WHERE r.id = CASE c.level
                    WHEN 1 THEN c.id
                    WHEN 2 THEN c.parent_id
                    WHEN 3 THEN (SELECT parent_id FROM category WHERE id = c.parent_id)
                  END
) root ON TRUE
GROUP BY root.id, root.name, s.attr_key, s.attr_slug, s.attr_value;

CREATE INDEX IF NOT EXISTS idx_faceta_dep  ON mv_faceta_spec(departamento_id, attr_slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_faceta ON mv_faceta_spec(departamento_id, attr_slug, attr_value);

-- ---------------------------------------------------------------------
-- Faixas de dimensão por departamento — sliders "de X a Y mm".
-- ---------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_faixa_dim;
CREATE MATERIALIZED VIEW mv_faixa_dim AS
SELECT
    v.departamento,
    count(*) FILTER (WHERE v.diametro_interno_mm IS NOT NULL) AS n_di,
    min(v.diametro_interno_mm) AS di_min, max(v.diametro_interno_mm) AS di_max,
    min(v.diametro_externo_mm) AS de_min, max(v.diametro_externo_mm) AS de_max,
    min(v.largura_mm)          AS lg_min, max(v.largura_mm)          AS lg_max,
    min(v.altura_mm)           AS al_min, max(v.altura_mm)           AS al_max,
    min(v.peso_kg)             AS peso_min, max(v.peso_kg)           AS peso_max,
    count(*)::int              AS qtd_produtos
FROM v_produto v
GROUP BY v.departamento;

CREATE UNIQUE INDEX IF NOT EXISTS uq_faixa_dim ON mv_faixa_dim(departamento);

-- ---------------------------------------------------------------------
-- Refresh das materializadas (CONCURRENTLY: não bloqueia leitura).
-- Rodar depois de cada carga: SELECT imdepa.refresh_catalogo();
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION imdepa.refresh_catalogo()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_faceta_spec;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_faixa_dim;
END $$;
