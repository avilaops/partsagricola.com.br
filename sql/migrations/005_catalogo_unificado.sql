-- =====================================================================
--  005 — Catálogo unificado: um vocabulário de medida para todas as fontes
--
--  O problema: cada fornecedor nomeia a MESMA medida física de um jeito.
--    furo de 30 mm  ->  Imdepa "Diâmetro Interno" / retentor "eixo_mm"
--                       gaxeta "interno_mm"       / o-ring "diametro_interno_mm"
--  Como a busca do site compara metadata com igualdade exata, o cliente
--  precisa saber de antemão de que fornecedor é a peça para acertar o
--  campo. Na prateleira é a mesma peça.
--
--  A solução NÃO é fundir produtos. Cruzar por código não funciona aqui:
--  medido, imdepa x qualquer outra fonte = 0 códigos em comum, e os
--  poucos que batem entre as outras são colisão numérica (o código 6234
--  é "facão para cana" numa fonte e retentor de 27 mm noutra). Fundir por
--  código corromperia o catálogo.
--
--  O elo real é a MEDIDA. Cada produto continua sendo o do seu
--  fornecedor; o que se unifica é o vocabulário para buscá-los juntos.
--  Fornecedor vira atributo, não divisória.
-- =====================================================================
SET search_path TO imdepa, catalogo, public;

-- ---------------------------------------------------------------------
-- FORNECEDOR
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fornecedor (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO fornecedor (nome, slug) VALUES
    ('Imdepa',             'imdepa'),
    ('Geomaq',             'geomaq'),
    ('Rio Preto Vedações', 'rio-preto-vedacoes'),
    ('Agel',               'agel')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- TIPO DE PEÇA — o que a peça É, transversal a fornecedor.
--   Sem isso, "furo 30 x externo 47" devolveria retentor, rolamento e
--   gaxeta misturados sem o cliente poder dizer o que procura.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipo_peca (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    -- quais medidas fazem sentido para este tipo (guia a UI do filtro)
    usa_interno BOOLEAN NOT NULL DEFAULT TRUE,
    usa_externo BOOLEAN NOT NULL DEFAULT TRUE,
    usa_altura  BOOLEAN NOT NULL DEFAULT TRUE,
    usa_secao   BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO tipo_peca (nome, slug, usa_interno, usa_externo, usa_altura, usa_secao) VALUES
    ('Rolamento',  'rolamento',  TRUE,  TRUE,  TRUE,  FALSE),
    ('Retentor',   'retentor',   TRUE,  TRUE,  TRUE,  FALSE),
    ('Gaxeta',     'gaxeta',     TRUE,  TRUE,  TRUE,  FALSE),
    ('O-Ring',     'o-ring',     TRUE,  FALSE, FALSE, TRUE),
    ('Correia',    'correia',    FALSE, FALSE, FALSE, FALSE),
    ('Mancal',     'mancal',     TRUE,  TRUE,  TRUE,  FALSE),
    ('Bucha',      'bucha',      TRUE,  TRUE,  TRUE,  FALSE),
    ('Outro',      'outro',      TRUE,  TRUE,  TRUE,  FALSE)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- ITEM UNIFICADO — uma linha por produto de cada fornecedor.
--   NÃO funde produtos: dois fornecedores com a mesma medida geram duas
--   linhas, e é exatamente isso que se quer mostrar lado a lado.
--
--   `origem` + `origem_id` apontam para o registro na fonte, então nada
--   aqui é fonte da verdade — é uma camada de BUSCA sobre o que já existe.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item (
    id             SERIAL PRIMARY KEY,
    fornecedor_id  INTEGER NOT NULL REFERENCES fornecedor(id),
    tipo_id        INTEGER REFERENCES tipo_peca(id),

    -- de onde veio (para reconciliar e para linkar no site)
    origem         TEXT NOT NULL,      -- 'imdepa' | 'retentores' | 'orings' | ...
    origem_id      TEXT NOT NULL,      -- product_id / código na fonte
    sku_odoo       TEXT,               -- quando casar com catalogo_odoo

    codigo         TEXT NOT NULL,
    codigo_norm    TEXT NOT NULL,      -- maiúsculo, só alfanumérico
    nome           TEXT NOT NULL,
    marca          TEXT,
    linha          TEXT,

    -- VOCABULÁRIO ÚNICO DE MEDIDA (sempre mm)
    interno_mm     NUMERIC(12,3),      -- furo / eixo / diâmetro interno
    externo_mm     NUMERIC(12,3),
    altura_mm      NUMERIC(12,3),      -- altura / largura / espessura
    secao_mm       NUMERIC(12,3),      -- só o-ring

    material       TEXT,
    descricao      TEXT,
    imagem_url     TEXT,

    spec           JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_tsv     TSVECTOR,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (origem, origem_id)
);

-- ---------------------------------------------------------------------
-- Índices: o filtro dimensional é o motivo desta tabela existir.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_item_medidas
    ON item (tipo_id, interno_mm, externo_mm, altura_mm);
CREATE INDEX IF NOT EXISTS idx_item_interno ON item (interno_mm) WHERE interno_mm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_externo ON item (externo_mm) WHERE externo_mm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_secao   ON item (secao_mm)   WHERE secao_mm   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_forn    ON item (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_item_codnorm ON item (codigo_norm);
CREATE INDEX IF NOT EXISTS idx_item_tsv     ON item USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS idx_item_nome_trgm
    ON item USING gin (imdepa.f_unaccent(nome) gin_trgm_ops);

CREATE OR REPLACE FUNCTION imdepa.item_tsv_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_tsv :=
        setweight(to_tsvector('portuguese', imdepa.f_unaccent(coalesce(NEW.codigo,''))), 'A') ||
        setweight(to_tsvector('portuguese', imdepa.f_unaccent(coalesce(NEW.nome,''))),   'B') ||
        setweight(to_tsvector('portuguese', imdepa.f_unaccent(coalesce(NEW.marca,'') || ' ' ||
                                                              coalesce(NEW.descricao,''))), 'C');
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_item_tsv ON item;
CREATE TRIGGER trg_item_tsv BEFORE INSERT OR UPDATE ON item
    FOR EACH ROW EXECUTE FUNCTION imdepa.item_tsv_update();

-- ---------------------------------------------------------------------
-- View de consulta: item + fornecedor + tipo, achatado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_item AS
SELECT i.id, i.codigo, i.nome, i.marca, i.linha,
       f.nome  AS fornecedor,
       f.slug  AS fornecedor_slug,
       t.nome  AS tipo,
       t.slug  AS tipo_slug,
       i.interno_mm, i.externo_mm, i.altura_mm, i.secao_mm,
       i.material, i.descricao, i.imagem_url,
       i.origem, i.origem_id, i.sku_odoo, i.spec, i.search_tsv
FROM item i
JOIN fornecedor f ON f.id = i.fornecedor_id
LEFT JOIN tipo_peca t ON t.id = i.tipo_id;

-- ---------------------------------------------------------------------
-- EQUIVALÊNCIA POR MEDIDA — o coração da unificação.
--   "esta peça, de quais fornecedores eu tenho?"
--   Casa itens do MESMO tipo com medidas dentro da tolerância, de
--   fornecedores DIFERENTES. Não afirma que são idênticas; afirma que
--   são candidatas intercambiáveis — que é o que o balcão precisa.
--
--   tol: 0.5 mm cobre o arredondamento das fontes sem casar peças
--   claramente distintas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION imdepa.equivalentes(
    p_item_id INTEGER,
    tol       NUMERIC DEFAULT 0.5
)
RETURNS TABLE (
    id INTEGER, codigo TEXT, nome TEXT, fornecedor TEXT, marca TEXT,
    interno_mm NUMERIC, externo_mm NUMERIC, altura_mm NUMERIC,
    diferenca NUMERIC
) LANGUAGE sql STABLE AS $$
    SELECT o.id, o.codigo, o.nome, f.nome, o.marca,
           o.interno_mm, o.externo_mm, o.altura_mm,
           abs(coalesce(o.interno_mm,0) - coalesce(a.interno_mm,0))
         + abs(coalesce(o.externo_mm,0) - coalesce(a.externo_mm,0))
         + abs(coalesce(o.altura_mm,0)  - coalesce(a.altura_mm,0)) AS diferenca
      FROM item a
      JOIN item o
        ON o.id <> a.id
       AND o.tipo_id IS NOT DISTINCT FROM a.tipo_id
       AND o.fornecedor_id <> a.fornecedor_id
       -- cada medida que o alvo declara precisa bater dentro da tolerância
       AND (a.interno_mm IS NULL OR o.interno_mm BETWEEN a.interno_mm - tol AND a.interno_mm + tol)
       AND (a.externo_mm IS NULL OR o.externo_mm BETWEEN a.externo_mm - tol AND a.externo_mm + tol)
       AND (a.altura_mm  IS NULL OR o.altura_mm  BETWEEN a.altura_mm  - tol AND a.altura_mm  + tol)
      JOIN fornecedor f ON f.id = o.fornecedor_id
     WHERE a.id = p_item_id
       -- só faz sentido para quem tem ao menos uma medida
       AND (a.interno_mm IS NOT NULL OR a.externo_mm IS NOT NULL)
     ORDER BY diferenca, f.nome
$$;
