ALTER TABLE marketplace.company
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS website text;

CREATE TABLE IF NOT EXISTS marketplace.company_category (
  company_id uuid NOT NULL REFERENCES marketplace.company(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES marketplace.part_category(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, category_id)
);

CREATE TABLE IF NOT EXISTS marketplace.company_service_region (
  company_id uuid NOT NULL REFERENCES marketplace.company(id) ON DELETE CASCADE,
  state_code char(2) NOT NULL CHECK (state_code ~ '^[A-Z]{2}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, state_code)
);

CREATE INDEX IF NOT EXISTS company_category_category_idx
  ON marketplace.company_category(category_id, company_id);
