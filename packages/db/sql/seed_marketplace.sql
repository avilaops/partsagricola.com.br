INSERT INTO marketplace.currency (code, name, symbol, decimals, active)
VALUES ('BRL', 'Real brasileiro', 'R$', 2, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  symbol = EXCLUDED.symbol,
  decimals = EXCLUDED.decimals,
  active = EXCLUDED.active;

INSERT INTO marketplace.market
  (code, name, default_currency, default_locale, timezone, active)
VALUES
  ('BR', 'Brasil', 'BRL', 'pt-BR', 'America/Sao_Paulo', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  default_currency = EXCLUDED.default_currency,
  default_locale = EXCLUDED.default_locale,
  timezone = EXCLUDED.timezone,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO marketplace.machine_type (name, slug) VALUES
  ('Trator', 'trator'),
  ('Colheitadeira', 'colheitadeira'),
  ('Plantadeira', 'plantadeira'),
  ('Pulverizador', 'pulverizador'),
  ('Implemento', 'implemento'),
  ('Caminhão', 'caminhao'),
  ('Ônibus', 'onibus'),
  ('Linha amarela', 'linha-amarela')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, active = true;

INSERT INTO marketplace.brand (name, slug) VALUES
  ('John Deere', 'john-deere'),
  ('Massey Ferguson', 'massey-ferguson'),
  ('Valtra', 'valtra'),
  ('New Holland', 'new-holland'),
  ('Case IH', 'case-ih'),
  ('Agrale', 'agrale'),
  ('Mahindra', 'mahindra'),
  ('Fendt', 'fendt'),
  ('Claas', 'claas'),
  ('Kubota', 'kubota'),
  ('LS Tractor', 'ls-tractor'),
  ('Landini', 'landini'),
  ('Yanmar', 'yanmar'),
  ('Scania', 'scania'),
  ('Volvo', 'volvo'),
  ('Mercedes-Benz', 'mercedes-benz'),
  ('Iveco', 'iveco'),
  ('DAF', 'daf'),
  ('Caterpillar', 'caterpillar'),
  ('Komatsu', 'komatsu'),
  ('JCB', 'jcb'),
  ('Hyundai', 'hyundai'),
  ('Volvo CE', 'volvo-ce')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, active = true, updated_at = now();

WITH associations(machine_type_slug, brand_slug) AS (
  VALUES
    ('trator','john-deere'), ('trator','massey-ferguson'),
    ('trator','valtra'), ('trator','new-holland'), ('trator','case-ih'),
    ('trator','agrale'), ('trator','mahindra'), ('trator','fendt'),
    ('trator','claas'), ('trator','kubota'), ('trator','ls-tractor'),
    ('trator','landini'), ('trator','yanmar'),
    ('colheitadeira','john-deere'), ('colheitadeira','new-holland'),
    ('colheitadeira','case-ih'), ('colheitadeira','claas'),
    ('plantadeira','john-deere'), ('plantadeira','new-holland'),
    ('plantadeira','case-ih'), ('pulverizador','john-deere'),
    ('pulverizador','new-holland'), ('pulverizador','case-ih'),
    ('caminhao','scania'), ('caminhao','volvo'),
    ('caminhao','mercedes-benz'), ('caminhao','iveco'), ('caminhao','daf'),
    ('onibus','volvo'), ('onibus','mercedes-benz'), ('onibus','iveco'),
    ('linha-amarela','caterpillar'), ('linha-amarela','komatsu'),
    ('linha-amarela','jcb'), ('linha-amarela','hyundai'),
    ('linha-amarela','volvo-ce')
)
INSERT INTO marketplace.machine_type_brand(machine_type_id,brand_id,active)
SELECT mt.id,b.id,true
  FROM associations a
  JOIN marketplace.machine_type mt ON mt.slug=a.machine_type_slug
  JOIN marketplace.brand b ON b.slug=a.brand_slug
ON CONFLICT (machine_type_id,brand_id) DO UPDATE SET
  active=true,
  updated_at=now();

INSERT INTO marketplace.part_category (name, slug) VALUES
  ('Motor', 'motor'),
  ('Transmissão', 'transmissao'),
  ('Hidráulica', 'hidraulica'),
  ('Elétrica', 'eletrica'),
  ('Filtros e manutenção', 'filtros-e-manutencao'),
  ('Vedações e retentores', 'vedacoes-e-retentores'),
  ('Rodagem e esteiras', 'rodagem-e-esteiras'),
  ('Freios', 'freios'),
  ('Cabine e acabamento', 'cabine-e-acabamento'),
  ('Implementos agrícolas', 'implementos-agricolas')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, active = true;

INSERT INTO public.app_setting (key, value)
VALUES ('brand_name', 'PARTSAGRICOLA')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

INSERT INTO marketplace.auth_role (key, name, requires_totp) VALUES
  ('USER', 'Usuário', false),
  ('SUPPORT', 'Suporte', false),
  ('FINANCE', 'Financeiro', true),
  ('ADMIN', 'Administrador', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  requires_totp = EXCLUDED.requires_totp;

INSERT INTO marketplace.auth_connector
  (provider,enabled,client_id_env,client_secret_env,authorization_endpoint,token_endpoint,userinfo_endpoint,scopes)
VALUES
  ('GOOGLE',false,'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','https://accounts.google.com/o/oauth2/v2/auth','https://oauth2.googleapis.com/token','https://openidconnect.googleapis.com/v1/userinfo',ARRAY['openid','email','profile']),
  ('FACEBOOK',false,'FACEBOOK_CLIENT_ID','FACEBOOK_CLIENT_SECRET','https://www.facebook.com/v22.0/dialog/oauth','https://graph.facebook.com/v22.0/oauth/access_token','https://graph.facebook.com/me',ARRAY['email','public_profile']),
  ('APPLE',false,'APPLE_CLIENT_ID','APPLE_CLIENT_SECRET','https://appleid.apple.com/auth/authorize','https://appleid.apple.com/auth/token','https://appleid.apple.com/auth/userinfo',ARRAY['openid','email','name']),
  ('MICROSOFT',false,'MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET','https://login.microsoftonline.com/common/oauth2/v2.0/authorize','https://login.microsoftonline.com/common/oauth2/v2.0/token','https://graph.microsoft.com/oidc/userinfo',ARRAY['openid','email','profile'])
ON CONFLICT (provider) DO UPDATE SET
  client_id_env = EXCLUDED.client_id_env,
  client_secret_env = EXCLUDED.client_secret_env,
  authorization_endpoint = EXCLUDED.authorization_endpoint,
  token_endpoint = EXCLUDED.token_endpoint,
  userinfo_endpoint = EXCLUDED.userinfo_endpoint,
  scopes = EXCLUDED.scopes,
  updated_at = now();

INSERT INTO marketplace.auth_client (client_id,name,scopes) VALUES
  ('partsagricola-web','Marketplace web',ARRAY['openid','profile','email','offline_access']),
  ('partsagricola-seller','Área do fornecedor',ARRAY['openid','profile','email','offline_access']),
  ('partsagricola-admin','Administração',ARRAY['openid','profile','email','offline_access']),
  ('partsagricola-mobile','Aplicativos móveis',ARRAY['openid','profile','email','offline_access'])
ON CONFLICT (client_id) DO UPDATE SET
  name = EXCLUDED.name,
  scopes = EXCLUDED.scopes,
  active = true,
  updated_at = now();

INSERT INTO marketplace.auth_client_redirect (client_id,redirect_uri,kind) VALUES
  ('partsagricola-web','http://127.0.0.1:3000/auth/callback','LOGIN'),
  ('partsagricola-seller','http://127.0.0.1:3001/auth/callback','LOGIN'),
  ('partsagricola-admin','http://127.0.0.1:3002/auth/callback','LOGIN'),
  ('partsagricola-mobile','br.com.partsagricola.app:/oauth/callback','LOGIN'),
  ('partsagricola-web','http://127.0.0.1:3000','POST_LOGOUT'),
  ('partsagricola-seller','http://127.0.0.1:3001','POST_LOGOUT'),
  ('partsagricola-admin','http://127.0.0.1:3002','POST_LOGOUT')
ON CONFLICT (client_id,redirect_uri,kind) DO NOTHING;
