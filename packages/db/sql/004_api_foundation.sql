ALTER TABLE marketplace.audit_log
  ADD COLUMN IF NOT EXISTS market_id uuid REFERENCES marketplace.market(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS diff jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS marketplace.image_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  market_id uuid NOT NULL REFERENCES marketplace.market(id) ON DELETE RESTRICT,
  source_key text NOT NULL UNIQUE CHECK (source_key ~ '^uploads/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  derivatives jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(derivatives) = 'array'),
  error_message text,
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS image_job_poll_idx ON marketplace.image_job(status, available_at, created_at);
