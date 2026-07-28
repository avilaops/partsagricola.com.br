-- =====================================================================
--  Catálogo de Peças / Produtos — Schema Postgres
--  Fase 1: dados estruturados + imagens (Grupo Geomaq + Grupo Vedação)
--
--  Princípios de modelagem:
--   * marca e família são campos de PRIMEIRA CLASSE (não misturar
--     agrícola com vedação) — separação por marca/linha.
--   * produto  = item base (SKU/código).
--   * variante = variação por dimensão/material (usada p/ o-rings;
--     produtos agrícolas podem ter 0 variantes).
--   * atributo técnico = chave/valor flexível (specs que variam por
--     família) — evita colunas rígidas.
--   * imagem   = 1..N por produto (foto/recorte da célula do catálogo).
--
--  Simples hoje, com espaço para crescer (Medusa/site em fases futuras).
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS catalogo;
SET search_path TO catalogo, public;

-- extensões úteis (busca textual e acentos)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------
-- MARCA  (ex.: Geomaq, e futuramente Agel/vedação, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brand (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    segment     TEXT,                       -- 'agricola' | 'vedacao' | ...
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- LINHA / CATÁLOGO  (ex.: Algodão, Amendoim, Construção, Verde)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_line (
    id          SERIAL PRIMARY KEY,
    brand_id    INTEGER NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    catalog_year INTEGER,
    source_file TEXT,                        -- PDF de origem
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, slug)
);

-- ---------------------------------------------------------------------
-- FAMÍLIA DE PRODUTO  (ex.: ROLAMENTO, ENGRENAGEM, CORREIA, O-RING)
--   first-class e transversal às marcas/linhas.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_family (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- PRODUTO  (item base / SKU)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product (
    id              SERIAL PRIMARY KEY,
    brand_id        INTEGER NOT NULL REFERENCES brand(id),
    product_line_id INTEGER REFERENCES product_line(id),
    family_id       INTEGER REFERENCES product_family(id),
    sku             TEXT NOT NULL,           -- código/SKU do catálogo
    name            TEXT,
    description     TEXT,
    application     TEXT,                    -- aplicação (ex.: "Colhedoras de Algodão")
    price           NUMERIC(12,2),           -- nulo (catálogos sem preço)
    currency        CHAR(3) DEFAULT 'BRL',
    -- proveniência / qualidade da extração
    source_file     TEXT,
    source_page     INTEGER,
    extraction_source TEXT CHECK (extraction_source IN ('text','ocr')),
    ocr_confidence  NUMERIC(5,2),
    needs_review    BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (brand_id, product_line_id, sku)
);

-- ---------------------------------------------------------------------
-- VARIANTE  (variação por dimensão/material — o-rings)
--   Produtos sem variante simplesmente não têm linhas aqui.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variant (
    id            SERIAL PRIMARY KEY,
    product_id    INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    variant_sku   TEXT,                      -- SKU específico da variante
    name          TEXT,
    price         NUMERIC(12,2),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, variant_sku)
);

-- ---------------------------------------------------------------------
-- ATRIBUTO TÉCNICO  (chave/valor flexível)
--   Liga a product OU a product_variant (exatamente um).
--   Ex.: diâmetro_interno=15, unidade=mm ; material=NBR ; dentes=Z24
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_attribute (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER REFERENCES product(id) ON DELETE CASCADE,
    variant_id  INTEGER REFERENCES product_variant(id) ON DELETE CASCADE,
    attr_key    TEXT NOT NULL,
    attr_value  TEXT NOT NULL,
    unit        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(product_id, variant_id) = 1)   -- exatamente um alvo
);

-- ---------------------------------------------------------------------
-- IMAGEM  (1..N por produto)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_image (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    path        TEXT NOT NULL,               -- caminho relativo em images/
    kind        TEXT DEFAULT 'cell',         -- 'cell' (recorte) | 'photo' | ...
    source_page INTEGER,
    is_primary  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_brand    ON product(brand_id);
CREATE INDEX IF NOT EXISTS idx_product_line      ON product(product_line_id);
CREATE INDEX IF NOT EXISTS idx_product_family    ON product(family_id);
CREATE INDEX IF NOT EXISTS idx_product_sku       ON product(sku);
CREATE INDEX IF NOT EXISTS idx_product_review    ON product(needs_review);
CREATE INDEX IF NOT EXISTS idx_attr_product      ON product_attribute(product_id);
CREATE INDEX IF NOT EXISTS idx_attr_variant      ON product_attribute(variant_id);
CREATE INDEX IF NOT EXISTS idx_attr_key          ON product_attribute(attr_key);
CREATE INDEX IF NOT EXISTS idx_image_product     ON product_image(product_id);
CREATE INDEX IF NOT EXISTS idx_product_name_trgm ON product USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- View de conveniência: produto "achatado" com marca/linha/família
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_product_full AS
SELECT p.id, b.name AS marca, b.segment,
       pl.name AS linha, f.name AS familia,
       p.sku, p.name AS nome, p.application AS aplicacao,
       p.price, p.currency, p.source_file, p.source_page,
       p.extraction_source, p.ocr_confidence, p.needs_review, p.review_reason,
       (SELECT path FROM product_image i
         WHERE i.product_id = p.id AND i.is_primary LIMIT 1) AS imagem
FROM product p
JOIN brand b          ON b.id = p.brand_id
LEFT JOIN product_line pl ON pl.id = p.product_line_id
LEFT JOIN product_family f ON f.id = p.family_id;
