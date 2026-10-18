CREATE OR REPLACE FUNCTION marketplace.normalize_search(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(
    regexp_replace(
      lower(public.unaccent('public.unaccent', coalesce(value, ''))),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  )
$$;

CREATE TABLE IF NOT EXISTS marketplace.machine_type_brand (
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  machine_type_id uuid NOT NULL REFERENCES marketplace.machine_type(id) ON DELETE RESTRICT,
  brand_id uuid NOT NULL REFERENCES marketplace.brand(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (machine_type_id, brand_id)
);
CREATE INDEX IF NOT EXISTS machine_type_brand_brand_idx
  ON marketplace.machine_type_brand(brand_id, machine_type_id) WHERE active;

ALTER TABLE marketplace.machine_model
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE marketplace.part
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE marketplace.part_code
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE marketplace.part_fitment
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE marketplace.listing
  ADD COLUMN IF NOT EXISTS warranty_months smallint,
  ADD COLUMN IF NOT EXISTS rating_average numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'listing_warranty_months_check'
       AND conrelid = 'marketplace.listing'::regclass
  ) THEN
    ALTER TABLE marketplace.listing
      ADD CONSTRAINT listing_warranty_months_check
      CHECK (warranty_months IS NULL OR warranty_months BETWEEN 0 AND 120);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'listing_rating_average_check'
       AND conrelid = 'marketplace.listing'::regclass
  ) THEN
    ALTER TABLE marketplace.listing
      ADD CONSTRAINT listing_rating_average_check
      CHECK (rating_average BETWEEN 0 AND 5);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'listing_rating_count_check'
       AND conrelid = 'marketplace.listing'::regclass
  ) THEN
    ALTER TABLE marketplace.listing
      ADD CONSTRAINT listing_rating_count_check CHECK (rating_count >= 0);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS marketplace.exchange_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency char(3) NOT NULL REFERENCES marketplace.currency(code) ON DELETE RESTRICT,
  quote_currency char(3) NOT NULL REFERENCES marketplace.currency(code) ON DELETE RESTRICT,
  rate numeric(20,10) NOT NULL CHECK (rate > 0),
  effective_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency, effective_at),
  CHECK (base_currency <> quote_currency)
);
CREATE INDEX IF NOT EXISTS exchange_rate_latest_idx
  ON marketplace.exchange_rate(base_currency, quote_currency, effective_at DESC);

CREATE INDEX IF NOT EXISTS machine_type_name_search_idx
  ON marketplace.machine_type USING gin (marketplace.normalize_search(name) gin_trgm_ops)
  WHERE active;
CREATE INDEX IF NOT EXISTS brand_name_search_idx
  ON marketplace.brand USING gin (marketplace.normalize_search(name) gin_trgm_ops)
  WHERE active;
CREATE INDEX IF NOT EXISTS machine_model_name_search_idx
  ON marketplace.machine_model USING gin (marketplace.normalize_search(name) gin_trgm_ops)
  WHERE active;
CREATE INDEX IF NOT EXISTS part_category_name_search_idx
  ON marketplace.part_category USING gin (marketplace.normalize_search(name) gin_trgm_ops)
  WHERE active;
CREATE INDEX IF NOT EXISTS part_name_search_idx
  ON marketplace.part USING gin (marketplace.normalize_search(name) gin_trgm_ops)
  WHERE active;
CREATE INDEX IF NOT EXISTS part_code_search_idx
  ON marketplace.part_code USING gin (marketplace.normalize_search(code) gin_trgm_ops)
  WHERE active;
CREATE INDEX IF NOT EXISTS listing_search_text_trgm_idx
  ON marketplace.listing USING gin (search_text gin_trgm_ops)
  WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS listing_search_vector_idx
  ON marketplace.listing USING gin (to_tsvector('simple', search_text))
  WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS listing_public_price_idx
  ON marketplace.listing(price_currency, price_amount_minor, id)
  WHERE status = 'PUBLISHED' AND NOT price_on_request;
CREATE INDEX IF NOT EXISTS listing_public_recent_idx
  ON marketplace.listing(published_at DESC, id DESC)
  WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS listing_public_rating_idx
  ON marketplace.listing(rating_average DESC, rating_count DESC, id DESC)
  WHERE status = 'PUBLISHED';

CREATE OR REPLACE FUNCTION marketplace.build_listing_search_text(target_listing_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT marketplace.normalize_search(concat_ws(' ',
    l.title,
    l.description,
    p.name,
    p.description,
    pb.name,
    mm.name,
    mb.name,
    mt.name,
    pc.name,
    codes.values,
    fitments.values
  ))
  FROM marketplace.listing l
  LEFT JOIN marketplace.part p ON p.id = l.part_id
  LEFT JOIN marketplace.brand pb ON pb.id = p.brand_id
  LEFT JOIN marketplace.part_category pc ON pc.id = p.category_id
  LEFT JOIN marketplace.machine_model mm ON mm.id = l.machine_model_id
  LEFT JOIN marketplace.brand mb ON mb.id = mm.brand_id
  LEFT JOIN marketplace.machine_type mt ON mt.id = mm.machine_type_id
  LEFT JOIN LATERAL (
    SELECT string_agg(code, ' ' ORDER BY id) AS values
      FROM marketplace.part_code
     WHERE part_id = p.id AND active
  ) codes ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(concat_ws(' ', fit_model.name, fit_brand.name, fit_type.name), ' ' ORDER BY pf.id) AS values
      FROM marketplace.part_fitment pf
      JOIN marketplace.machine_model fit_model ON fit_model.id = pf.machine_model_id AND fit_model.active
      JOIN marketplace.brand fit_brand ON fit_brand.id = fit_model.brand_id AND fit_brand.active
      JOIN marketplace.machine_type fit_type ON fit_type.id = fit_model.machine_type_id AND fit_type.active
     WHERE pf.part_id = p.id AND pf.active
  ) fitments ON true
  WHERE l.id = target_listing_id
$$;

CREATE OR REPLACE FUNCTION marketplace.refresh_listing_search(target_listing_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE marketplace.listing
     SET search_text = coalesce(marketplace.build_listing_search_text(target_listing_id), '')
   WHERE id = target_listing_id
$$;

CREATE OR REPLACE FUNCTION marketplace.refresh_listing_search_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM marketplace.refresh_listing_search(NEW.id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS listing_refresh_search ON marketplace.listing;
CREATE TRIGGER listing_refresh_search
AFTER INSERT OR UPDATE OF title, description, part_id, machine_model_id
ON marketplace.listing
FOR EACH ROW EXECUTE FUNCTION marketplace.refresh_listing_search_trigger();

CREATE OR REPLACE FUNCTION marketplace.refresh_part_listings_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  affected_part_id uuid;
BEGIN
  affected_part_id := coalesce(NEW.part_id, OLD.part_id);
  UPDATE marketplace.listing l
     SET search_text = marketplace.build_listing_search_text(l.id)
   WHERE l.part_id = affected_part_id;
  RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS part_code_refresh_search ON marketplace.part_code;
CREATE TRIGGER part_code_refresh_search
AFTER INSERT OR UPDATE OR DELETE ON marketplace.part_code
FOR EACH ROW EXECUTE FUNCTION marketplace.refresh_part_listings_trigger();

DROP TRIGGER IF EXISTS part_fitment_refresh_search ON marketplace.part_fitment;
CREATE TRIGGER part_fitment_refresh_search
AFTER INSERT OR UPDATE OR DELETE ON marketplace.part_fitment
FOR EACH ROW EXECUTE FUNCTION marketplace.refresh_part_listings_trigger();

CREATE OR REPLACE FUNCTION marketplace.refresh_part_row_listings_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE marketplace.listing l
     SET search_text = marketplace.build_listing_search_text(l.id)
   WHERE l.part_id = coalesce(NEW.id, OLD.id);
  RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS part_refresh_search ON marketplace.part;
CREATE TRIGGER part_refresh_search
AFTER UPDATE OF name, description, brand_id, category_id, active ON marketplace.part
FOR EACH ROW EXECUTE FUNCTION marketplace.refresh_part_row_listings_trigger();

CREATE OR REPLACE FUNCTION marketplace.refresh_machine_model_listings_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE marketplace.listing l
     SET search_text = marketplace.build_listing_search_text(l.id)
   WHERE l.machine_model_id = coalesce(NEW.id, OLD.id)
      OR l.part_id IN (
        SELECT pf.part_id FROM marketplace.part_fitment pf
         WHERE pf.machine_model_id = coalesce(NEW.id, OLD.id)
      );
  RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS machine_model_refresh_search ON marketplace.machine_model;
CREATE TRIGGER machine_model_refresh_search
AFTER UPDATE OF name, brand_id, machine_type_id, active ON marketplace.machine_model
FOR EACH ROW EXECUTE FUNCTION marketplace.refresh_machine_model_listings_trigger();

CREATE OR REPLACE FUNCTION marketplace.refresh_brand_listings_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE marketplace.listing l
     SET search_text = marketplace.build_listing_search_text(l.id)
   WHERE l.part_id IN (SELECT p.id FROM marketplace.part p WHERE p.brand_id = NEW.id)
      OR l.machine_model_id IN (SELECT mm.id FROM marketplace.machine_model mm WHERE mm.brand_id = NEW.id)
      OR l.part_id IN (
        SELECT pf.part_id FROM marketplace.part_fitment pf
        JOIN marketplace.machine_model mm ON mm.id = pf.machine_model_id
        WHERE mm.brand_id = NEW.id
      );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS brand_refresh_search ON marketplace.brand;
CREATE TRIGGER brand_refresh_search
AFTER UPDATE OF name, active ON marketplace.brand
FOR EACH ROW EXECUTE FUNCTION marketplace.refresh_brand_listings_trigger();

CREATE OR REPLACE FUNCTION marketplace.refresh_machine_type_listings_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE marketplace.listing l
     SET search_text = marketplace.build_listing_search_text(l.id)
   WHERE l.machine_model_id IN (SELECT mm.id FROM marketplace.machine_model mm WHERE mm.machine_type_id = NEW.id)
      OR l.part_id IN (
        SELECT pf.part_id FROM marketplace.part_fitment pf
        JOIN marketplace.machine_model mm ON mm.id = pf.machine_model_id
        WHERE mm.machine_type_id = NEW.id
      );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS machine_type_refresh_search ON marketplace.machine_type;
CREATE TRIGGER machine_type_refresh_search
AFTER UPDATE OF name, active ON marketplace.machine_type
FOR EACH ROW EXECUTE FUNCTION marketplace.refresh_machine_type_listings_trigger();

CREATE OR REPLACE FUNCTION marketplace.refresh_category_listings_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE marketplace.listing l
     SET search_text = marketplace.build_listing_search_text(l.id)
   WHERE l.part_id IN (SELECT p.id FROM marketplace.part p WHERE p.category_id = NEW.id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS part_category_refresh_search ON marketplace.part_category;
CREATE TRIGGER part_category_refresh_search
AFTER UPDATE OF name, active ON marketplace.part_category
FOR EACH ROW EXECUTE FUNCTION marketplace.refresh_category_listings_trigger();

UPDATE marketplace.listing l
   SET search_text = marketplace.build_listing_search_text(l.id);
