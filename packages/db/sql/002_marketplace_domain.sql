CREATE SCHEMA IF NOT EXISTS marketplace;

CREATE OR REPLACE FUNCTION marketplace.normalize_digits(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g')
$$;

CREATE OR REPLACE FUNCTION marketplace.normalize_code(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT upper(regexp_replace(coalesce(value, ''), '[^[:alnum:]]', '', 'g'))
$$;

CREATE OR REPLACE FUNCTION marketplace.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

CREATE TABLE IF NOT EXISTS marketplace.currency (
  code char(3) PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  decimals smallint NOT NULL DEFAULT 2 CHECK (decimals BETWEEN 0 AND 4),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS marketplace.market (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code char(2) NOT NULL UNIQUE,
  name text NOT NULL,
  default_currency char(3) NOT NULL REFERENCES marketplace.currency(code),
  default_locale text NOT NULL,
  timezone text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace.app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_user_email_uq
  ON marketplace.app_user (lower(btrim(email)));

CREATE TABLE IF NOT EXISTS marketplace.company (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES marketplace.market(id),
  cnpj text NOT NULL,
  legal_name text NOT NULL,
  trade_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  email text NOT NULL,
  phone text,
  state_code char(2) NOT NULL,
  city text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(marketplace.normalize_digits(cnpj)) = 14),
  CHECK ((status = 'APPROVED' AND approved_at IS NOT NULL) OR status <> 'APPROVED')
);
CREATE UNIQUE INDEX IF NOT EXISTS company_cnpj_uq
  ON marketplace.company (marketplace.normalize_digits(cnpj));

CREATE TABLE IF NOT EXISTS marketplace.company_member (
  company_id uuid NOT NULL REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'EDITOR', 'VIEWER')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS marketplace.company_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  kind text NOT NULL,
  storage_key text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by_user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind, storage_key)
);

CREATE TABLE IF NOT EXISTS marketplace.machine_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace.brand (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_name_trgm_idx
  ON marketplace.brand USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS marketplace.machine_model (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_type_id uuid NOT NULL REFERENCES marketplace.machine_type(id) ON DELETE RESTRICT,
  brand_id uuid NOT NULL REFERENCES marketplace.brand(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  year_start smallint,
  year_end smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, slug),
  CHECK (year_start IS NULL OR year_start BETWEEN 1900 AND 2200),
  CHECK (year_end IS NULL OR year_end BETWEEN 1900 AND 2200),
  CHECK (year_start IS NULL OR year_end IS NULL OR year_end >= year_start)
);

CREATE TABLE IF NOT EXISTS marketplace.part_category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES marketplace.part_category(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace.part (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES marketplace.part_category(id) ON DELETE RESTRICT,
  brand_id uuid REFERENCES marketplace.brand(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(specifications) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS part_name_trgm_idx
  ON marketplace.part USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS part_category_idx ON marketplace.part(category_id);
CREATE INDEX IF NOT EXISTS part_brand_idx ON marketplace.part(brand_id);

CREATE TABLE IF NOT EXISTS marketplace.part_code (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES marketplace.part(id) ON DELETE RESTRICT,
  code text NOT NULL,
  normalized_code text GENERATED ALWAYS AS (marketplace.normalize_code(code)) STORED,
  kind text NOT NULL DEFAULT 'ORIGINAL' CHECK (kind IN ('ORIGINAL', 'EQUIVALENT', 'OEM', 'GTIN', 'SUPPLIER')),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_id, normalized_code, kind),
  CHECK (length(normalized_code) > 0)
);
CREATE INDEX IF NOT EXISTS part_code_normalized_idx ON marketplace.part_code(normalized_code);
CREATE INDEX IF NOT EXISTS part_code_trgm_idx
  ON marketplace.part_code USING gin (normalized_code gin_trgm_ops);

CREATE TABLE IF NOT EXISTS marketplace.part_fitment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES marketplace.part(id) ON DELETE RESTRICT,
  machine_model_id uuid NOT NULL REFERENCES marketplace.machine_model(id) ON DELETE RESTRICT,
  year_start smallint,
  year_end smallint,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_id, machine_model_id, year_start, year_end),
  CHECK (year_start IS NULL OR year_start BETWEEN 1900 AND 2200),
  CHECK (year_end IS NULL OR year_end BETWEEN 1900 AND 2200),
  CHECK (year_start IS NULL OR year_end IS NULL OR year_end >= year_start)
);

CREATE TABLE IF NOT EXISTS marketplace.legacy_catalog_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('PART', 'MACHINE_MODEL')),
  entity_id uuid NOT NULL,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_payload) = 'object'),
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS marketplace.listing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  listing_type text NOT NULL CHECK (listing_type IN ('PART', 'MACHINE')),
  part_id uuid REFERENCES marketplace.part(id) ON DELETE RESTRICT,
  machine_model_id uuid REFERENCES marketplace.machine_model(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) >= 3),
  description text NOT NULL CHECK (length(btrim(description)) >= 10),
  condition text NOT NULL CHECK (condition IN ('NEW', 'USED', 'RECONDITIONED', 'REMANUFACTURED')),
  price_amount_minor bigint CHECK (price_amount_minor IS NULL OR price_amount_minor >= 0),
  price_currency char(3) REFERENCES marketplace.currency(code) ON DELETE RESTRICT,
  price_on_request boolean NOT NULL DEFAULT true,
  state_code char(2) NOT NULL,
  city text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'REJECTED', 'ARCHIVED')),
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  CHECK ((listing_type = 'PART' AND machine_model_id IS NULL) OR (listing_type = 'MACHINE' AND part_id IS NULL)),
  CHECK ((price_on_request AND price_amount_minor IS NULL) OR (NOT price_on_request AND price_amount_minor IS NOT NULL AND price_currency IS NOT NULL)),
  CHECK ((status = 'PUBLISHED' AND published_at IS NOT NULL) OR status <> 'PUBLISHED')
);
CREATE INDEX IF NOT EXISTS listing_company_status_idx ON marketplace.listing(company_id, status);
CREATE INDEX IF NOT EXISTS listing_filters_idx ON marketplace.listing(status, listing_type, condition, state_code, city);
CREATE INDEX IF NOT EXISTS listing_category_idx ON marketplace.listing(part_id) WHERE part_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS listing_machine_idx ON marketplace.listing(machine_model_id) WHERE machine_model_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS listing_title_trgm_idx ON marketplace.listing USING gin (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS marketplace.listing_image (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace.listing(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  position smallint NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, position)
);

CREATE TABLE IF NOT EXISTS marketplace.favorite (
  user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  listing_id uuid NOT NULL REFERENCES marketplace.listing(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS marketplace.part_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  buyer_company_id uuid REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  target_company_id uuid REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES marketplace.part_category(id) ON DELETE RESTRICT,
  brand_id uuid REFERENCES marketplace.brand(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) >= 3),
  description text NOT NULL CHECK (length(btrim(description)) >= 10),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (buyer_company_id, buyer_user_id)
    REFERENCES marketplace.company_member(company_id, user_id) ON DELETE RESTRICT,
  CHECK (buyer_company_id IS NULL OR buyer_company_id <> target_company_id)
);
CREATE INDEX IF NOT EXISTS part_request_target_idx ON marketplace.part_request(target_company_id, status);

CREATE TABLE IF NOT EXISTS marketplace.part_request_image (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_request_id uuid NOT NULL REFERENCES marketplace.part_request(id) ON DELETE CASCADE,
  url text NOT NULL,
  position smallint NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_request_id, position)
);

CREATE TABLE IF NOT EXISTS marketplace.listing_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  advertiser_company_id uuid NOT NULL,
  buyer_user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  buyer_company_id uuid REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'WITHDRAWN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, advertiser_company_id),
  UNIQUE (listing_id, buyer_user_id),
  FOREIGN KEY (listing_id, advertiser_company_id)
    REFERENCES marketplace.listing(id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (buyer_company_id, buyer_user_id)
    REFERENCES marketplace.company_member(company_id, user_id) ON DELETE RESTRICT,
  CHECK (buyer_company_id IS NULL OR buyer_company_id <> advertiser_company_id)
);
CREATE INDEX IF NOT EXISTS listing_interest_advertiser_idx ON marketplace.listing_interest(advertiser_company_id, status);

CREATE TABLE IF NOT EXISTS marketplace.proposal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id uuid NOT NULL,
  advertiser_company_id uuid NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  issuer_company_id uuid REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('BUYER_TO_ADVERTISER', 'ADVERTISER_TO_BUYER')),
  amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency char(3) REFERENCES marketplace.currency(code) ON DELETE RESTRICT,
  terms text NOT NULL CHECK (length(btrim(terms)) >= 3),
  status text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED')),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (interest_id, advertiser_company_id)
    REFERENCES marketplace.listing_interest(id, advertiser_company_id) ON DELETE RESTRICT,
  FOREIGN KEY (issuer_company_id, created_by_user_id)
    REFERENCES marketplace.company_member(company_id, user_id) ON DELETE RESTRICT,
  CHECK ((amount_minor IS NULL AND currency IS NULL) OR (amount_minor IS NOT NULL AND currency IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS proposal_interest_idx ON marketplace.proposal(interest_id, created_at);

CREATE TABLE IF NOT EXISTS marketplace.conversation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id uuid REFERENCES marketplace.listing_interest(id) ON DELETE RESTRICT,
  part_request_id uuid REFERENCES marketplace.part_request(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(interest_id, part_request_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS conversation_interest_uq ON marketplace.conversation(interest_id) WHERE interest_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversation_request_uq ON marketplace.conversation(part_request_id) WHERE part_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS marketplace.conversation_participant (
  conversation_id uuid NOT NULL REFERENCES marketplace.conversation(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (company_id, user_id)
    REFERENCES marketplace.company_member(company_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS marketplace.message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  FOREIGN KEY (conversation_id, sender_user_id)
    REFERENCES marketplace.conversation_participant(conversation_id, user_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS message_conversation_idx ON marketplace.message(conversation_id, created_at, id);

CREATE TABLE IF NOT EXISTS marketplace.notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  correlation_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(user_id, company_id) >= 1)
);

CREATE TABLE IF NOT EXISTS marketplace.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  correlation_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON marketplace.audit_log(entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS marketplace.app_setting (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace.feature_flag (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION marketplace.guard_listing_publication()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  company_status text;
BEGIN
  IF NEW.status = 'PUBLISHED' THEN
    SELECT status INTO company_status
      FROM marketplace.company
     WHERE id = NEW.company_id
     FOR SHARE;
    IF company_status IS DISTINCT FROM 'APPROVED' THEN
      RAISE EXCEPTION 'LISTING_COMPANY_NOT_APPROVED' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS listing_publication_guard ON marketplace.listing;
CREATE TRIGGER listing_publication_guard
  BEFORE INSERT OR UPDATE OF status, company_id ON marketplace.listing
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_publication();

CREATE OR REPLACE FUNCTION marketplace.pause_listings_after_company_revocation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'APPROVED' AND NEW.status <> 'APPROVED' THEN
    UPDATE marketplace.listing
       SET status = 'PAUSED', updated_at = now()
     WHERE company_id = NEW.id AND status = 'PUBLISHED';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS company_listing_revocation ON marketplace.company;
CREATE TRIGGER company_listing_revocation
  AFTER UPDATE OF status ON marketplace.company
  FOR EACH ROW EXECUTE FUNCTION marketplace.pause_listings_after_company_revocation();

CREATE OR REPLACE FUNCTION marketplace.guard_legacy_catalog_link()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  entity_exists boolean;
BEGIN
  IF NEW.entity_type = 'PART' THEN
    SELECT true INTO entity_exists
      FROM marketplace.part
     WHERE id = NEW.entity_id
     FOR KEY SHARE;
  ELSIF NEW.entity_type = 'MACHINE_MODEL' THEN
    SELECT true INTO entity_exists
      FROM marketplace.machine_model
     WHERE id = NEW.entity_id
     FOR KEY SHARE;
  ELSE
    entity_exists := false;
  END IF;
  IF NOT coalesce(entity_exists, false) THEN
    RAISE EXCEPTION 'LEGACY_ENTITY_NOT_FOUND' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS legacy_catalog_link_guard ON marketplace.legacy_catalog_link;
CREATE TRIGGER legacy_catalog_link_guard
  BEFORE INSERT OR UPDATE OF entity_type, entity_id
  ON marketplace.legacy_catalog_link
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_legacy_catalog_link();

CREATE OR REPLACE FUNCTION marketplace.guard_legacy_entity_removal()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_type text;
BEGIN
  expected_type := CASE TG_TABLE_NAME
    WHEN 'part' THEN 'PART'
    WHEN 'machine_model' THEN 'MACHINE_MODEL'
  END;
  IF EXISTS (
    SELECT 1 FROM marketplace.legacy_catalog_link
     WHERE entity_type = expected_type AND entity_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'LEGACY_ENTITY_STILL_REFERENCED' USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END
$$;

DROP TRIGGER IF EXISTS part_legacy_reference_guard ON marketplace.part;
CREATE TRIGGER part_legacy_reference_guard
  BEFORE DELETE OR UPDATE OF id ON marketplace.part
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_legacy_entity_removal();

DROP TRIGGER IF EXISTS machine_model_legacy_reference_guard ON marketplace.machine_model;
CREATE TRIGGER machine_model_legacy_reference_guard
  BEFORE DELETE OR UPDATE OF id ON marketplace.machine_model
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_legacy_entity_removal();

CREATE OR REPLACE FUNCTION marketplace.require_active_membership(company uuid, member uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF company IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM marketplace.company_member
     WHERE company_id = company AND user_id = member AND active
  ) THEN
    RAISE EXCEPTION 'COMPANY_MEMBERSHIP_NOT_ACTIVE' USING ERRCODE = '23514';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION marketplace.guard_buyer_membership()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM marketplace.require_active_membership(NEW.buyer_company_id, NEW.buyer_user_id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS part_request_active_buyer ON marketplace.part_request;
CREATE TRIGGER part_request_active_buyer
  BEFORE INSERT OR UPDATE OF buyer_company_id, buyer_user_id
  ON marketplace.part_request
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_buyer_membership();

DROP TRIGGER IF EXISTS listing_interest_active_buyer ON marketplace.listing_interest;
CREATE TRIGGER listing_interest_active_buyer
  BEFORE INSERT OR UPDATE OF buyer_company_id, buyer_user_id
  ON marketplace.listing_interest
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_buyer_membership();

CREATE OR REPLACE FUNCTION marketplace.guard_participant_membership()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM marketplace.require_active_membership(NEW.company_id, NEW.user_id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS conversation_participant_active_member ON marketplace.conversation_participant;
CREATE TRIGGER conversation_participant_active_member
  BEFORE INSERT OR UPDATE OF company_id, user_id
  ON marketplace.conversation_participant
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_participant_membership();

CREATE OR REPLACE FUNCTION marketplace.guard_proposal_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  interest marketplace.listing_interest%ROWTYPE;
BEGIN
  SELECT * INTO interest
    FROM marketplace.listing_interest
   WHERE id = NEW.interest_id AND advertiser_company_id = NEW.advertiser_company_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.direction = 'BUYER_TO_ADVERTISER' THEN
    IF NEW.created_by_user_id IS DISTINCT FROM interest.buyer_user_id
       OR NEW.issuer_company_id IS DISTINCT FROM interest.buyer_company_id THEN
      RAISE EXCEPTION 'PROPOSAL_BUYER_IDENTITY_INVALID' USING ERRCODE = '23514';
    END IF;
    PERFORM marketplace.require_active_membership(
      interest.buyer_company_id, NEW.created_by_user_id
    );
  ELSIF NEW.direction = 'ADVERTISER_TO_BUYER' THEN
    IF NEW.issuer_company_id IS DISTINCT FROM interest.advertiser_company_id THEN
      RAISE EXCEPTION 'PROPOSAL_ADVERTISER_IDENTITY_INVALID' USING ERRCODE = '23514';
    END IF;
    PERFORM marketplace.require_active_membership(
      interest.advertiser_company_id, NEW.created_by_user_id
    );
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS proposal_identity_guard ON marketplace.proposal;
CREATE TRIGGER proposal_identity_guard
  BEFORE INSERT OR UPDATE OF interest_id, advertiser_company_id,
    created_by_user_id, issuer_company_id, direction
  ON marketplace.proposal
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_proposal_identity();

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'market', 'app_user', 'company', 'brand', 'machine_model', 'part',
    'listing', 'part_request', 'listing_interest', 'proposal', 'conversation'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON marketplace.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER touch_updated_at BEFORE UPDATE ON marketplace.%I FOR EACH ROW EXECUTE FUNCTION marketplace.touch_updated_at()',
      table_name
    );
  END LOOP;
END
$$;
