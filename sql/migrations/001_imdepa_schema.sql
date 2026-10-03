-- =====================================================================
--  001 — Catálogo Imdepa: schema base
--
--  Modelo híbrido, pensado para catálogo + filtros:
--    * colunas PROMOVIDAS (diâmetro interno/externo, largura, altura,
--      peso...) — numéricas e normalizadas em mm/kg, indexadas com
--      B-tree para filtro por FAIXA rápido;
--    * spec (JSONB)  — TODAS as ~200 características técnicas cruas,
--      preservadas 1:1 como vieram da fonte (nada se perde);
--    * product_spec  — as mesmas specs em chave/valor com valor
--      numérico normalizado, para facetas dinâmicas ("quais valores de
--      'Tipo de Furo' existem nesta categoria e quantos produtos há
--      em cada?") sem precisar de coluna nova a cada atributo.
--
--  O porquê do híbrido: coluna promovida é rápida mas rígida; JSONB é
--  flexível mas ruim para range. Os dois juntos dão filtro rápido nos
--  ~10 atributos que a loja realmente filtra, e cobertura total no resto.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS imdepa;
-- catalogo entra no path porque unaccent/pg_trgm foram instalados lá (schema.sql original)
SET search_path TO imdepa, catalogo, public;

CREATE EXTENSION IF NOT EXISTS unaccent;   -- busca ignorando acento
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- busca por similaridade / typo
CREATE EXTENSION IF NOT EXISTS btree_gin;  -- índice composto GIN escalar+jsonb

-- ---------------------------------------------------------------------
-- Imutável: unaccent() é STABLE, e índice de expressão exige IMMUTABLE.
-- Passamos o dicionário explicitamente (forma 2-args) porque a 1-arg
-- depende do search_path — o que quebraria o índice num backup/restore.
-- O schema do dicionário é resolvido em tempo de criação: neste banco a
-- extensão já existia em `catalogo`, mas noutro pode estar em `public`.
-- ---------------------------------------------------------------------
DO $mig$
DECLARE
    dict_schema TEXT;
BEGIN
    SELECT n.nspname INTO dict_schema
      FROM pg_ts_dict d JOIN pg_namespace n ON n.oid = d.dictnamespace
     WHERE d.dictname = 'unaccent'
     LIMIT 1;

    IF dict_schema IS NULL THEN
        RAISE EXCEPTION 'dicionário unaccent não encontrado';
    END IF;

    EXECUTE format($fn$
        CREATE OR REPLACE FUNCTION imdepa.f_unaccent(text)
        RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
        $body$ SELECT %I.unaccent(%L::regdictionary, $1) $body$
    $fn$, dict_schema, dict_schema || '.unaccent');
END $mig$;

-- ---------------------------------------------------------------------
-- MARCA  (FAG, SKF, TIMKEN, Sabó, Continental, ...)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brand (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- CATEGORIA  (3 níveis, auto-referente: Rolamentos > Radial de Esfera ...)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category (
    id          SERIAL PRIMARY KEY,
    parent_id   INTEGER REFERENCES category(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    level       SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parent_id, slug)
);
-- raiz (parent_id NULL) precisa de unicidade própria: UNIQUE acima não
-- pega NULLs, então dois "Rolamentos" raiz passariam.
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_root
    ON category (slug) WHERE parent_id IS NULL;

-- ---------------------------------------------------------------------
-- PRODUTO
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product (
    id              SERIAL PRIMARY KEY,
    -- identidade / origem
    product_id      TEXT NOT NULL UNIQUE,     -- id da loja (chave natural)
    slug            TEXT NOT NULL,
    url             TEXT,
    -- título e códigos
    nome            TEXT NOT NULL,            -- Título
    codigo          TEXT,                     -- código do fabricante
    codigo_imdepa   TEXT,                     -- código interno do distribuidor
    codigo_montadora TEXT,
    gtin            TEXT,
    ncm             TEXT,
    -- classificação
    brand_id        INTEGER REFERENCES brand(id),
    category_id     INTEGER REFERENCES category(id),  -- categoria mais específica
    -- comercial
    -- Preço NÃO vem da fonte: a loja Imdepa só exibe preço a quem está
    -- logado ("sob consulta"). Colunas ficam prontas para quando houver
    -- tabela de preço própria; price_on_request marca o estado atual.
    price            NUMERIC(12,2),
    currency         CHAR(3) NOT NULL DEFAULT 'BRL',
    price_on_request BOOLEAN NOT NULL DEFAULT TRUE,
    -- texto
    descricao       TEXT,
    aplicacao       TEXT,                     -- Industrial | Agrícola | ...
    utilizacao      TEXT,                     -- uso declarado, quando há
    -- características promovidas (normalizadas: mm, kg, N, rpm)
    diametro_interno_mm NUMERIC(12,3),
    diametro_externo_mm NUMERIC(12,3),
    largura_mm          NUMERIC(12,3),
    altura_mm           NUMERIC(12,3),
    comprimento_mm      NUMERIC(12,3),
    espessura_mm        NUMERIC(12,3),
    peso_kg             NUMERIC(12,4),
    carga_dinamica_n    NUMERIC(14,2),
    carga_estatica_n    NUMERIC(14,2),
    velocidade_limite_rpm NUMERIC(12,2),
    material            TEXT,
    tipo                TEXT,
    vedacao             TEXT,
    -- todas as specs cruas, sem perda
    spec            JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- busca
    search_tsv      TSVECTOR,
    -- proveniência
    scraped_erro    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- IMAGEM  (1..N por produto; position 1 = foto principal)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_image (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    position    SMALLINT NOT NULL DEFAULT 1,   -- 1 = foto1, 2 = foto2, ...
    is_primary  BOOLEAN GENERATED ALWAYS AS (position = 1) STORED,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, position)
);

-- ---------------------------------------------------------------------
-- SPEC chave/valor  (para facetas dinâmicas e filtro por atributo raro)
--   value_num preenchido quando o valor é numérico → permite range mesmo
--   em atributo não promovido (ex.: "Ângulo de contato").
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_spec (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    attr_key    TEXT NOT NULL,                 -- rótulo original ("Diâmetro Interno")
    attr_slug   TEXT NOT NULL,                 -- normalizado ("diametro-interno")
    attr_value  TEXT NOT NULL,                 -- valor original ("35 mm")
    value_num   NUMERIC(16,4),                 -- 35.000 quando numérico
    unit        TEXT,                          -- "mm"
    UNIQUE (product_id, attr_slug)
);

-- ---------------------------------------------------------------------
-- MÁQUINA / EQUIPAMENTO  +  compatibilidade N:N
--   Extraído do payload "Aplicação Equipamentos" (1.185 produtos,
--   1.821 máquinas): "JOHN DEERE 9750STS (1 ATÉ 999999)".
--   É o filtro mais valioso de um catálogo agrícola: "peças que servem
--   na minha colheitadeira".
-- ---------------------------------------------------------------------
-- O slug é a identidade: a fonte escreve a mesma máquina de formas
-- diferentes ("CASE IH A8800" e "CASE-IH A8800"), e normalizar para
-- `case-ih-a8800` funde as duas grafias numa máquina só — que é o
-- comportamento desejado num filtro "serve na minha colheitadeira".
-- full_name guarda a primeira grafia vista, para exibição.
CREATE TABLE IF NOT EXISTS machine (
    id          SERIAL PRIMARY KEY,
    maker       TEXT,                          -- JOHN DEERE
    model       TEXT NOT NULL,                 -- 9750STS
    full_name   TEXT NOT NULL,                 -- "JOHN DEERE 9750STS"
    slug        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_machine (
    product_id  INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    machine_id  INTEGER NOT NULL REFERENCES machine(id) ON DELETE CASCADE,
    serial_range TEXT,                         -- "1 ATÉ 999999"
    PRIMARY KEY (product_id, machine_id)
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_brand    ON product(brand_id);
CREATE INDEX IF NOT EXISTS idx_product_category ON product(category_id);
CREATE INDEX IF NOT EXISTS idx_product_codigo   ON product(codigo);
CREATE INDEX IF NOT EXISTS idx_product_cod_imd  ON product(codigo_imdepa);
CREATE INDEX IF NOT EXISTS idx_product_gtin     ON product(gtin) WHERE gtin <> '';

-- filtros por faixa (o coração do catálogo): parciais, para não indexar
-- as milhares de linhas NULL de cada dimensão.
CREATE INDEX IF NOT EXISTS idx_product_di ON product(diametro_interno_mm) WHERE diametro_interno_mm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_de ON product(diametro_externo_mm) WHERE diametro_externo_mm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_lg ON product(largura_mm)          WHERE largura_mm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_al ON product(altura_mm)           WHERE altura_mm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_pk ON product(peso_kg)             WHERE peso_kg IS NOT NULL;

-- combinação típica de rolamento: DI + DE + largura na mesma categoria
CREATE INDEX IF NOT EXISTS idx_product_dims
    ON product(category_id, diametro_interno_mm, diametro_externo_mm, largura_mm);

-- busca textual (português) e por similaridade/typo
CREATE INDEX IF NOT EXISTS idx_product_tsv       ON product USING gin(search_tsv);
CREATE INDEX IF NOT EXISTS idx_product_nome_trgm ON product USING gin (imdepa.f_unaccent(nome) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_cod_trgm  ON product USING gin (imdepa.f_unaccent(codigo) gin_trgm_ops);

-- specs
CREATE INDEX IF NOT EXISTS idx_product_spec_jsonb ON product USING gin(spec jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_spec_product  ON product_spec(product_id);
CREATE INDEX IF NOT EXISTS idx_spec_slug_val ON product_spec(attr_slug, attr_value);
CREATE INDEX IF NOT EXISTS idx_spec_slug_num ON product_spec(attr_slug, value_num) WHERE value_num IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_image_product ON product_image(product_id);
CREATE INDEX IF NOT EXISTS idx_pm_machine    ON product_machine(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_trgm  ON machine USING gin (imdepa.f_unaccent(full_name) gin_trgm_ops);

-- ---------------------------------------------------------------------
-- search_tsv: mantido por trigger (nome + código + marca + categoria +
-- descrição). Pesos: A = identificadores, B = nome, C = resto — assim
-- buscar "6205" acha o rolamento pelo código antes de qualquer descrição
-- que só cite o número.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION imdepa.product_tsv_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_tsv :=
        setweight(to_tsvector('portuguese', imdepa.f_unaccent(coalesce(NEW.codigo,'')        || ' ' ||
                                                              coalesce(NEW.codigo_imdepa,'') || ' ' ||
                                                              coalesce(NEW.codigo_montadora,''))), 'A') ||
        setweight(to_tsvector('portuguese', imdepa.f_unaccent(coalesce(NEW.nome,''))),      'B') ||
        setweight(to_tsvector('portuguese', imdepa.f_unaccent(coalesce(NEW.descricao,'') || ' ' ||
                                                              coalesce(NEW.aplicacao,''))), 'C');
    NEW.updated_at := now();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_product_tsv ON product;
CREATE TRIGGER trg_product_tsv
    BEFORE INSERT OR UPDATE ON product
    FOR EACH ROW EXECUTE FUNCTION imdepa.product_tsv_update();
