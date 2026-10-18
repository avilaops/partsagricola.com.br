CREATE TABLE IF NOT EXISTS marketplace.auth_role (
  key text PRIMARY KEY CHECK (key IN ('USER', 'SUPPORT', 'FINANCE', 'ADMIN')),
  name text NOT NULL,
  requires_totp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace.auth_user_role (
  user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  role_key text NOT NULL REFERENCES marketplace.auth_role(key) ON DELETE RESTRICT,
  granted_by_user_id uuid REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_key)
);

CREATE TABLE IF NOT EXISTS marketplace.auth_credential (
  user_id uuid PRIMARY KEY REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  password_hash text,
  cpf_digest bytea UNIQUE,
  totp_secret_encrypted bytea,
  totp_enabled boolean NOT NULL DEFAULT false,
  recovery_code_hashes bytea[] NOT NULL DEFAULT '{}',
  email_verified_at timestamptz,
  failed_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cpf_digest IS NULL OR octet_length(cpf_digest) = 32),
  CHECK (NOT totp_enabled OR totp_secret_encrypted IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS marketplace.auth_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('GOOGLE', 'FACEBOOK', 'APPLE', 'MICROSOFT')),
  subject text NOT NULL,
  email text,
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject),
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS auth_identity_user_idx
  ON marketplace.auth_identity(user_id);

CREATE TABLE IF NOT EXISTS marketplace.auth_connector (
  provider text PRIMARY KEY CHECK (provider IN ('GOOGLE', 'FACEBOOK', 'APPLE', 'MICROSOFT')),
  enabled boolean NOT NULL DEFAULT false,
  client_id_env text NOT NULL,
  client_secret_env text NOT NULL,
  authorization_endpoint text NOT NULL CHECK (authorization_endpoint ~ '^https://'),
  token_endpoint text NOT NULL CHECK (token_endpoint ~ '^https://'),
  userinfo_endpoint text NOT NULL CHECK (userinfo_endpoint ~ '^https://'),
  scopes text[] NOT NULL CHECK (cardinality(scopes) > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace.auth_client (
  client_id text PRIMARY KEY,
  name text NOT NULL,
  client_type text NOT NULL DEFAULT 'PUBLIC' CHECK (client_type = 'PUBLIC'),
  scopes text[] NOT NULL DEFAULT ARRAY['openid']::text[] CHECK ('openid' = ANY(scopes)),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace.auth_client_redirect (
  client_id text NOT NULL REFERENCES marketplace.auth_client(client_id) ON DELETE RESTRICT,
  redirect_uri text NOT NULL,
  kind text NOT NULL DEFAULT 'LOGIN' CHECK (kind IN ('LOGIN', 'POST_LOGOUT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, redirect_uri, kind),
  UNIQUE (client_id, redirect_uri),
  CHECK (redirect_uri ~ '^(https?://|[a-z][a-z0-9+.-]*:/)')
);

CREATE TABLE IF NOT EXISTS marketplace.auth_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  user_agent_hash bytea CHECK (user_agent_hash IS NULL OR octet_length(user_agent_hash) = 32),
  ip_hash bytea CHECK (ip_hash IS NULL OR octet_length(ip_hash) = 32),
  second_factor_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (idle_expires_at <= expires_at)
);
CREATE INDEX IF NOT EXISTS auth_session_user_active_idx
  ON marketplace.auth_session(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS marketplace.auth_transaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle_hash bytea NOT NULL UNIQUE CHECK (octet_length(handle_hash) = 32),
  client_id text NOT NULL REFERENCES marketplace.auth_client(client_id) ON DELETE RESTRICT,
  redirect_uri text NOT NULL,
  state text,
  nonce text,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256' CHECK (code_challenge_method = 'S256'),
  scopes text[] NOT NULL CHECK ('openid' = ANY(scopes)),
  session_id uuid REFERENCES marketplace.auth_session(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AUTHENTICATED', 'COMPLETED', 'CANCELED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (client_id, redirect_uri)
    REFERENCES marketplace.auth_client_redirect(client_id, redirect_uri)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS marketplace.auth_authorization_code (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash bytea NOT NULL UNIQUE CHECK (octet_length(code_hash) = 32),
  transaction_id uuid NOT NULL UNIQUE REFERENCES marketplace.auth_transaction(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES marketplace.auth_session(id) ON DELETE RESTRICT,
  client_id text NOT NULL REFERENCES marketplace.auth_client(client_id) ON DELETE RESTRICT,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  nonce text,
  scopes text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_authorization_code_expiry_idx
  ON marketplace.auth_authorization_code(expires_at) WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS marketplace.auth_refresh_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  family_id uuid NOT NULL,
  parent_id uuid REFERENCES marketplace.auth_refresh_token(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES marketplace.auth_session(id) ON DELETE RESTRICT,
  client_id text NOT NULL REFERENCES marketplace.auth_client(client_id) ON DELETE RESTRICT,
  scopes text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_refresh_family_idx
  ON marketplace.auth_refresh_token(family_id, created_at);
CREATE INDEX IF NOT EXISTS auth_refresh_session_active_idx
  ON marketplace.auth_refresh_token(session_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS marketplace.auth_one_time_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES marketplace.app_user(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('EMAIL_VERIFY', 'PASSWORD_RESET', 'INVITE')),
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_one_time_user_idx
  ON marketplace.auth_one_time_token(user_id, kind, expires_at);

CREATE TABLE IF NOT EXISTS marketplace.auth_social_signup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle_hash bytea NOT NULL UNIQUE CHECK (octet_length(handle_hash) = 32),
  provider text NOT NULL CHECK (provider IN ('GOOGLE', 'FACEBOOK', 'APPLE', 'MICROSOFT')),
  subject text NOT NULL,
  email text,
  email_verified boolean NOT NULL DEFAULT false,
  name text,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(profile) = 'object'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);

CREATE TABLE IF NOT EXISTS marketplace.auth_login_attempt (
  id bigserial PRIMARY KEY,
  identifier_hash bytea NOT NULL CHECK (octet_length(identifier_hash) = 32),
  ip_hash bytea CHECK (ip_hash IS NULL OR octet_length(ip_hash) = 32),
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_login_attempt_rate_idx
  ON marketplace.auth_login_attempt(identifier_hash, attempted_at DESC);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'auth_credential', 'auth_identity', 'auth_connector', 'auth_client'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON marketplace.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER touch_updated_at BEFORE UPDATE ON marketplace.%I FOR EACH ROW EXECUTE FUNCTION marketplace.touch_updated_at()',
      table_name
    );
  END LOOP;
END
$$;
