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
