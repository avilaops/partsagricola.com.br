-- =====================================================================
--  006 — equivalentes(): usar o índice em vez de varrer a tabela
--
--  A versão da migration 005 comparava as medidas do alvo dentro do
--  próprio JOIN ("a.interno_mm IS NULL OR o.interno_mm BETWEEN ...").
--  Como `a` só é conhecido em tempo de execução, o planner não conseguia
--  transformar aquilo em busca por índice e varria as 34.917 linhas a
--  cada chamada: 268 ms para devolver 10 resultados.
--
--  Aqui o alvo é lido ANTES (PL/pgSQL, uma busca por PK) e as medidas
--  entram como constantes, o que deixa idx_item_medidas ser usado.
-- =====================================================================
SET search_path TO imdepa, catalogo, public;

DROP FUNCTION IF EXISTS imdepa.equivalentes(INTEGER, NUMERIC);

CREATE FUNCTION imdepa.equivalentes(
    p_item_id INTEGER,
    tol       NUMERIC DEFAULT 0.5
)
RETURNS TABLE (
    id INTEGER, codigo TEXT, nome TEXT, fornecedor TEXT, marca TEXT,
    interno_mm NUMERIC, externo_mm NUMERIC, altura_mm NUMERIC,
    diferenca NUMERIC
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    a_tipo INTEGER;
    a_forn INTEGER;
    a_int  NUMERIC;
    a_ext  NUMERIC;
    a_alt  NUMERIC;
BEGIN
    SELECT i.tipo_id, i.fornecedor_id, i.interno_mm, i.externo_mm, i.altura_mm
      INTO a_tipo, a_forn, a_int, a_ext, a_alt
      FROM item i WHERE i.id = p_item_id;

    -- sem medida não há como afirmar equivalência
    IF a_int IS NULL AND a_ext IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT o.id, o.codigo, o.nome, f.nome, o.marca,
           o.interno_mm, o.externo_mm, o.altura_mm,
           abs(coalesce(o.interno_mm, 0) - coalesce(a_int, 0))
         + abs(coalesce(o.externo_mm, 0) - coalesce(a_ext, 0))
         + abs(coalesce(o.altura_mm,  0) - coalesce(a_alt, 0)) AS diferenca
      FROM item o
      JOIN fornecedor f ON f.id = o.fornecedor_id
     WHERE o.id <> p_item_id
       AND o.fornecedor_id <> a_forn
       AND o.tipo_id IS NOT DISTINCT FROM a_tipo
       -- constantes: o índice (tipo_id, interno_mm, externo_mm, altura_mm) entra
       AND (a_int IS NULL OR o.interno_mm BETWEEN a_int - tol AND a_int + tol)
       AND (a_ext IS NULL OR o.externo_mm BETWEEN a_ext - tol AND a_ext + tol)
       AND (a_alt IS NULL OR o.altura_mm  BETWEEN a_alt - tol AND a_alt + tol)
     ORDER BY diferenca, f.nome;
END $$;

COMMENT ON FUNCTION imdepa.equivalentes(INTEGER, NUMERIC) IS
    'Peças de OUTROS fornecedores com a mesma medida (± tolerância) e o '
    'mesmo tipo. Não afirma identidade — afirma candidatas intercambiáveis.';
