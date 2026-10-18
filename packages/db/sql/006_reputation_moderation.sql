CREATE TABLE IF NOT EXISTS marketplace.review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL UNIQUE REFERENCES marketplace.proposal(id) ON DELETE RESTRICT,
  reviewer_user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  reviewed_company_id uuid NOT NULL REFERENCES marketplace.company(id) ON DELETE RESTRICT,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(btrim(comment)) >= 3),
  status text NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'HIDDEN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_company_status_idx ON marketplace.review(reviewed_company_id,status,created_at);

CREATE TABLE IF NOT EXISTS marketplace.moderation_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  entity_type text NOT NULL CHECK (entity_type IN ('COMPANY','LISTING','REVIEW')),
  entity_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  resolution text,
  resolved_by_user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_case_status_idx ON marketplace.moderation_case(status,created_at);
