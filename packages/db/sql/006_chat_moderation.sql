ALTER TABLE marketplace.conversation
  ADD COLUMN IF NOT EXISTS market_id uuid REFERENCES marketplace.market(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS context_type text,
  ADD COLUMN IF NOT EXISTS context_id uuid;

UPDATE marketplace.conversation c
SET context_type = CASE WHEN c.interest_id IS NOT NULL THEN 'LISTING' ELSE 'REQUEST' END,
    context_id = CASE
      WHEN c.interest_id IS NOT NULL THEN (
        SELECT li.listing_id FROM marketplace.listing_interest li WHERE li.id=c.interest_id
      )
      ELSE c.part_request_id
    END,
    market_id = coalesce(c.market_id, (
      SELECT company.market_id
      FROM marketplace.listing_interest li
      JOIN marketplace.company company ON company.id=li.advertiser_company_id
      WHERE li.id=c.interest_id
    ), (
      SELECT company.market_id
      FROM marketplace.part_request request
      JOIN marketplace.company company
        ON company.id=coalesce(request.target_company_id,request.buyer_company_id)
      WHERE request.id=c.part_request_id
    ))
WHERE context_type IS NULL OR context_id IS NULL OR market_id IS NULL;

CREATE OR REPLACE FUNCTION marketplace.fill_conversation_context()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.interest_id IS NOT NULL THEN
    NEW.context_type := coalesce(NEW.context_type, 'LISTING');
    SELECT li.listing_id, company.market_id
      INTO NEW.context_id, NEW.market_id
      FROM marketplace.listing_interest li
      JOIN marketplace.company company ON company.id=li.advertiser_company_id
     WHERE li.id=NEW.interest_id;
  ELSIF NEW.part_request_id IS NOT NULL THEN
    NEW.context_type := coalesce(NEW.context_type, 'REQUEST');
    NEW.context_id := coalesce(NEW.context_id, NEW.part_request_id);
    SELECT company.market_id INTO NEW.market_id
      FROM marketplace.part_request request
      JOIN marketplace.company company
        ON company.id=coalesce(request.target_company_id,request.buyer_company_id)
     WHERE request.id=NEW.part_request_id;
    IF NEW.market_id IS NULL THEN
      SELECT (array_agg(DISTINCT company.market_id))[1] INTO NEW.market_id
        FROM marketplace.part_request request
        JOIN marketplace.company_member member
          ON member.user_id=request.buyer_user_id AND member.active
        JOIN marketplace.company company ON company.id=member.company_id
       WHERE request.id=NEW.part_request_id
      HAVING count(DISTINCT company.market_id)=1;
    END IF;
    IF NEW.market_id IS NULL THEN
      SELECT (array_agg(id))[1] INTO NEW.market_id FROM marketplace.market
       WHERE active HAVING count(*)=1;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS conversation_context_fill ON marketplace.conversation;
CREATE TRIGGER conversation_context_fill
  BEFORE INSERT OR UPDATE OF interest_id,part_request_id,context_type,context_id,market_id
  ON marketplace.conversation
  FOR EACH ROW EXECUTE FUNCTION marketplace.fill_conversation_context();

ALTER TABLE marketplace.conversation
  ALTER COLUMN market_id SET NOT NULL,
  ALTER COLUMN context_type SET NOT NULL,
  ALTER COLUMN context_id SET NOT NULL;

ALTER TABLE marketplace.conversation
  DROP CONSTRAINT IF EXISTS conversation_check,
  DROP CONSTRAINT IF EXISTS conversation_context_type_check,
  ADD CONSTRAINT conversation_context_type_check
    CHECK (context_type IN ('LISTING', 'REQUEST', 'PROPOSAL', 'ORDER')),
  DROP CONSTRAINT IF EXISTS conversation_context_consistency_check,
  ADD CONSTRAINT conversation_context_consistency_check CHECK (
    (context_type = 'LISTING' AND interest_id IS NOT NULL AND part_request_id IS NULL)
    OR (context_type = 'REQUEST' AND part_request_id = context_id AND interest_id IS NULL)
    OR (context_type IN ('PROPOSAL', 'ORDER') AND interest_id IS NULL AND part_request_id IS NULL)
  );

DROP INDEX IF EXISTS marketplace.conversation_context_uq;
CREATE UNIQUE INDEX conversation_non_listing_context_uq
  ON marketplace.conversation(context_type, context_id)
  WHERE context_type <> 'LISTING';

ALTER TABLE marketplace.message
  ADD COLUMN IF NOT EXISTS client_message_id uuid,
  ADD COLUMN IF NOT EXISTS safe_body text,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'ALLOW',
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

UPDATE marketplace.message SET safe_body = body WHERE safe_body IS NULL;
ALTER TABLE marketplace.message ALTER COLUMN safe_body SET NOT NULL;
CREATE OR REPLACE FUNCTION marketplace.fill_message_safe_body()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.safe_body := coalesce(NEW.safe_body, NEW.body);
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS message_safe_body_fill ON marketplace.message;
CREATE TRIGGER message_safe_body_fill
  BEFORE INSERT OR UPDATE OF body,safe_body ON marketplace.message
  FOR EACH ROW EXECUTE FUNCTION marketplace.fill_message_safe_body();
ALTER TABLE marketplace.message
  DROP CONSTRAINT IF EXISTS message_moderation_status_check,
  ADD CONSTRAINT message_moderation_status_check
    CHECK (moderation_status IN ('ALLOW', 'MASK', 'BLOCK', 'PENDING_REVIEW'));
DROP INDEX IF EXISTS marketplace.message_sender_client_uq;
CREATE UNIQUE INDEX message_conversation_sender_client_uq
  ON marketplace.message(conversation_id, sender_user_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS marketplace.message_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES marketplace.message(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'QUARANTINED'
    CHECK (status IN ('QUARANTINED', 'APPROVED', 'REJECTED', 'REVIEW_REQUIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (message_id, position),
  UNIQUE (message_id, storage_key)
);

CREATE TABLE IF NOT EXISTS marketplace.moderation_flag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES marketplace.market(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  content_type text NOT NULL CHECK (content_type IN ('MESSAGE', 'LISTING', 'STORE', 'IMAGE')),
  content_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('ALLOW', 'MASK', 'BLOCK')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reasons) = 'array'),
  source text NOT NULL CHECK (source IN ('SYNC', 'ASYNC_TEXT', 'ASYNC_OCR', 'REPORT', 'REVIEW')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'APPROVED', 'REJECTED', 'RESOLVED')),
  redacted_excerpt text,
  reviewed_by_user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_flag_queue_idx
  ON marketplace.moderation_flag(status, decision, created_at);
CREATE INDEX IF NOT EXISTS moderation_flag_company_idx
  ON marketplace.moderation_flag(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_flag_user_idx
  ON marketplace.moderation_flag(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace.moderation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciphertext bytea NOT NULL,
  iv bytea NOT NULL CHECK (octet_length(iv) = 12),
  auth_tag bytea NOT NULL CHECK (octet_length(auth_tag) = 16),
  key_version smallint NOT NULL DEFAULT 1 CHECK (key_version > 0),
  sha256 char(64) NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at <= created_at + interval '7 days')
);
CREATE INDEX IF NOT EXISTS moderation_evidence_expiry_idx
  ON marketplace.moderation_evidence(expires_at);

CREATE TABLE IF NOT EXISTS marketplace.moderation_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES marketplace.market(id) ON DELETE RESTRICT,
  content_type text NOT NULL CHECK (content_type IN ('MESSAGE_TEXT', 'MESSAGE_IMAGE', 'LISTING_TEXT', 'STORE_TEXT')),
  content_id uuid NOT NULL,
  evidence_id uuid REFERENCES marketplace.moderation_evidence(id) ON DELETE SET NULL,
  storage_key text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVIEW_REQUIRED')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((content_type = 'MESSAGE_IMAGE' AND storage_key IS NOT NULL)
    OR (content_type <> 'MESSAGE_IMAGE' AND evidence_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS moderation_job_poll_idx
  ON marketplace.moderation_job(status, available_at, created_at);

CREATE TABLE IF NOT EXISTS marketplace.content_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES marketplace.market(id) ON DELETE RESTRICT,
  reporter_user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('MESSAGE', 'LISTING', 'STORE')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('CONTACT_ATTEMPT', 'FRAUD', 'ABUSE', 'MISLEADING', 'OTHER')),
  details text CHECK (details IS NULL OR length(details) <= 1000),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (reporter_user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS content_report_queue_idx
  ON marketplace.content_report(status, created_at);

CREATE TABLE IF NOT EXISTS marketplace.moderation_policy (
  market_id uuid PRIMARY KEY REFERENCES marketplace.market(id) ON DELETE RESTRICT,
  warning_threshold smallint NOT NULL DEFAULT 1 CHECK (warning_threshold > 0),
  suspend_threshold smallint NOT NULL DEFAULT 3 CHECK (suspend_threshold >= warning_threshold),
  block_threshold smallint NOT NULL DEFAULT 5 CHECK (block_threshold >= suspend_threshold),
  suspension_hours integer NOT NULL DEFAULT 72 CHECK (suspension_hours BETWEEN 1 AND 8760),
  updated_by_user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace.moderation_sanction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES marketplace.market(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  flag_id uuid REFERENCES marketplace.moderation_flag(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('WARNING', 'SUSPENSION', 'BLOCK')),
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by_user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(company_id, user_id) >= 1),
  CHECK ((kind = 'SUSPENSION' AND ends_at IS NOT NULL) OR kind <> 'SUSPENSION')
);
CREATE INDEX IF NOT EXISTS moderation_sanction_company_idx
  ON marketplace.moderation_sanction(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_sanction_user_idx
  ON marketplace.moderation_sanction(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION marketplace.purge_expired_moderation_evidence()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM marketplace.moderation_evidence WHERE expires_at <= now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END
$$;

DROP TRIGGER IF EXISTS touch_updated_at ON marketplace.moderation_flag;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON marketplace.moderation_flag
  FOR EACH ROW EXECUTE FUNCTION marketplace.touch_updated_at();

DROP TRIGGER IF EXISTS touch_updated_at ON marketplace.moderation_job;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON marketplace.moderation_job
  FOR EACH ROW EXECUTE FUNCTION marketplace.touch_updated_at();
