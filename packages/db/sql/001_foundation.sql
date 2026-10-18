CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TABLE IF NOT EXISTS app_setting (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS outbox_event (id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, event_type text NOT NULL, event_key text NOT NULL UNIQUE, correlation_id uuid NOT NULL, payload jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz);
CREATE INDEX IF NOT EXISTS outbox_event_pending_idx ON outbox_event (occurred_at) WHERE delivered_at IS NULL;
