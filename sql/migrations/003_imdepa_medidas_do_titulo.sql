-- =====================================================================
--  003 — Recupera medidas do TÍTULO do produto
--
--  Motivo: a tabela de informações técnicas da fonte quase nunca traz
--  "Largura" (só 114 dos 6.997 rolamentos), mas o título quase sempre
--  traz o padrão "35 mm x 62 mm x 14 mm" — 2.809 produtos. Extrair dali
--  leva a cobertura de largura de 114 para ~2.868 itens, o que é a
--  diferença entre o filtro dimensional ser inútil ou ser o principal
--  meio de achar um rolamento.
--
--  Só PREENCHE o que está vazio: a informação técnica declarada pela
--  fonte, quando existe, continua tendo precedência sobre o título.
--
--  Idempotente — pode rodar de novo depois de cada carga.
-- =====================================================================
SET search_path TO imdepa, catalogo, public;

-- marca a origem da medida, para auditoria e para o QA saber no que confiar
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS medidas_do_titulo BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------
-- "35 mm x 62 mm x 14 mm"  ->  {35, 62, 14}
-- Aceita vírgula decimal ("12,5 mm") e 'x' maiúsculo/minúsculo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION imdepa.medidas_do_nome(nome TEXT)
RETURNS NUMERIC[] LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE WHEN m IS NULL THEN NULL ELSE ARRAY[
        replace(m[1], ',', '.')::numeric,
        replace(m[2], ',', '.')::numeric,
        replace(m[3], ',', '.')::numeric
    ] END
    FROM regexp_match(
        nome,
        '([0-9]+(?:[.,][0-9]+)?)\s*mm\s*[xX]\s*([0-9]+(?:[.,][0-9]+)?)\s*mm\s*[xX]\s*([0-9]+(?:[.,][0-9]+)?)\s*mm'
    ) AS m
$$;

-- ---------------------------------------------------------------------
-- Preenche apenas os buracos (COALESCE mantém o que a fonte declarou)
-- ---------------------------------------------------------------------
WITH extraido AS (
    SELECT id, imdepa.medidas_do_nome(nome) AS m
    FROM product
    WHERE imdepa.medidas_do_nome(nome) IS NOT NULL
)
UPDATE product p
   SET diametro_interno_mm = COALESCE(p.diametro_interno_mm, e.m[1]),
       diametro_externo_mm = COALESCE(p.diametro_externo_mm, e.m[2]),
       largura_mm          = COALESCE(p.largura_mm,          e.m[3]),
       medidas_do_titulo   = (p.largura_mm IS NULL)
  FROM extraido e
 WHERE p.id = e.id
   AND (p.diametro_interno_mm IS NULL
     OR p.diametro_externo_mm IS NULL
     OR p.largura_mm IS NULL);

SELECT imdepa.refresh_catalogo();
