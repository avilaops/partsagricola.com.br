-- Conserva registros históricos para auditoria; novas cargas devem ser válidas.
SET search_path TO imdepa, catalogo, public;
INSERT INTO imdepa.tipo_peca (nome, slug) VALUES ('Raspador', 'raspador')
ON CONFLICT (slug) DO NOTHING;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='imdepa.item'::regclass AND conname='item_medidas_validas') THEN
        ALTER TABLE imdepa.item ADD CONSTRAINT item_medidas_validas CHECK (
            (interno_mm IS NULL OR interno_mm > 0 AND interno_mm < 100000) AND
            (externo_mm IS NULL OR externo_mm > 0 AND externo_mm < 100000) AND
            (altura_mm IS NULL OR altura_mm > 0 AND altura_mm < 100000) AND
            (secao_mm IS NULL OR secao_mm > 0 AND secao_mm < 100000) AND
            (interno_mm IS NULL OR externo_mm IS NULL OR externo_mm >= interno_mm)
        ) NOT VALID;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION imdepa.refresh_catalogo()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY imdepa.mv_faceta_spec;
    REFRESH MATERIALIZED VIEW CONCURRENTLY imdepa.mv_faixa_dim;
END $$;

CREATE OR REPLACE FUNCTION imdepa.equivalentes(p_item_id INTEGER, tol NUMERIC DEFAULT 0.5)
RETURNS TABLE (
    id INTEGER, codigo TEXT, nome TEXT, fornecedor TEXT, marca TEXT,
    interno_mm NUMERIC, externo_mm NUMERIC, altura_mm NUMERIC, diferenca NUMERIC
) LANGUAGE plpgsql STABLE AS $$
DECLARE
    alvo imdepa.item%ROWTYPE;
    tipo TEXT;
BEGIN
    IF tol IS NULL OR tol < 0 OR tol::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Tolerância deve ser finita e não negativa' USING ERRCODE='22023';
    END IF;
    SELECT i.* INTO alvo FROM imdepa.item i WHERE i.id=p_item_id;
    SELECT t.slug INTO tipo FROM imdepa.tipo_peca t WHERE t.id=alvo.tipo_id;
    IF tipo IS NULL OR tipo NOT IN ('o-ring','retentor','rolamento','gaxeta','raspador','mancal','bucha')
       OR alvo.interno_mm IS NULL
       OR (tipo='o-ring' AND alvo.secao_mm IS NULL)
       OR (tipo<>'o-ring' AND (alvo.externo_mm IS NULL OR alvo.altura_mm IS NULL)) THEN
        RETURN;
    END IF;
    RETURN QUERY
    SELECT o.id, o.codigo, o.nome, f.nome, o.marca,
           o.interno_mm, o.externo_mm, o.altura_mm,
           abs(o.interno_mm-alvo.interno_mm) + CASE WHEN tipo='o-ring'
             THEN abs(o.secao_mm-alvo.secao_mm)
             ELSE abs(o.externo_mm-alvo.externo_mm)+abs(o.altura_mm-alvo.altura_mm) END
      FROM imdepa.item o JOIN imdepa.fornecedor f ON f.id=o.fornecedor_id
     WHERE o.id<>p_item_id AND o.fornecedor_id<>alvo.fornecedor_id AND o.tipo_id=alvo.tipo_id
       AND o.interno_mm BETWEEN alvo.interno_mm-tol AND alvo.interno_mm+tol
       AND CASE WHEN tipo='o-ring' THEN o.secao_mm BETWEEN alvo.secao_mm-tol AND alvo.secao_mm+tol
           ELSE o.externo_mm BETWEEN alvo.externo_mm-tol AND alvo.externo_mm+tol
            AND o.altura_mm BETWEEN alvo.altura_mm-tol AND alvo.altura_mm+tol END
     ORDER BY 9, f.nome, o.id;
END $$;
COMMENT ON FUNCTION imdepa.equivalentes(INTEGER, NUMERIC) IS
    'Candidatas por dimensões completas e tipo. Não certifica intercambiabilidade; material, tolerâncias e aplicação precisam ser conferidos.';
