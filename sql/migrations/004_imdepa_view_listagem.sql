-- =====================================================================
--  004 — View enxuta para LISTAGEM / BUSCA
--
--  Motivo: v_produto traz 4 subconsultas correlacionadas por linha (foto
--  principal, contagem de fotos, array de fotos, array de máquinas).
--  Num LIMIT simples isso quase não pesa, porque o Postgres só as avalia
--  nas linhas devolvidas. Mas quando há ORDER BY — ou seja, em qualquer
--  listagem paginada — ele precisa ordenar o conjunto inteiro ANTES de
--  cortar, e aí as subconsultas rodam para os 12.502 produtos.
--
--  Medido neste banco (ORDER BY titulo LIMIT 50 OFFSET 2000):
--      v_produto            908 ms
--      v_produto_listagem    90 ms      (~10x)
--
--  v_produto_listagem traz só o que a grade mostra, com a foto vindo de
--  um LEFT JOIN em vez de subconsulta. Use:
--     * v_produto_listagem  -> grade, busca, filtro, paginação
--     * v_produto           -> ficha do produto (1 item), onde as fotos
--                              e as máquinas em array são justamente o
--                              que se quer
-- =====================================================================
SET search_path TO imdepa, catalogo, public;

CREATE OR REPLACE VIEW v_produto_listagem AS
SELECT
    p.id,
    p.product_id,
    p.nome            AS titulo,
    p.codigo,
    b.name            AS marca,
    c.name            AS categoria,
    raiz.name         AS departamento,
    CASE WHEN p.price_on_request THEN NULL ELSE p.price END AS price,
    p.price_on_request,
    p.diametro_interno_mm,
    p.diametro_externo_mm,
    p.largura_mm,
    p.altura_mm,
    p.peso_kg,
    p.material,
    p.tipo,
    p.aplicacao,
    img.url           AS foto_principal,
    p.search_tsv
FROM product p
LEFT JOIN brand b    ON b.id = p.brand_id
LEFT JOIN category c ON c.id = p.category_id
-- departamento = raiz da árvore de categorias
LEFT JOIN LATERAL (
    SELECT r.name FROM category r
     WHERE r.id = CASE c.level
                    WHEN 1 THEN c.id
                    WHEN 2 THEN c.parent_id
                    WHEN 3 THEN (SELECT parent_id FROM category WHERE id = c.parent_id)
                  END
) raiz ON TRUE
-- foto principal por JOIN (barato) em vez de subconsulta por linha
LEFT JOIN product_image img ON img.product_id = p.id AND img.position = 1;
