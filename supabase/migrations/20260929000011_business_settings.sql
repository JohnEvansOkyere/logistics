-- Business settings (F1): issuer details, currencies, tax lines, numbering
-- prefixes, payment terms and quote boilerplate, kept as append-only
-- revisions. The newest revision is the current one. Quote numbers read their
-- prefix from it.

CREATE TABLE app.business_settings_revision (
  revision_number integer PRIMARY KEY CHECK (revision_number > 0),
  settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
  changed_by uuid NOT NULL REFERENCES auth.users (id),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION app.prevent_business_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'business settings revisions are append-only';
END;
$$;

REVOKE ALL ON FUNCTION app.prevent_business_settings_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER business_settings_append_only
  BEFORE UPDATE OR DELETE ON app.business_settings_revision
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_business_settings_change();

ALTER TABLE app.business_settings_revision ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.business_settings_revision FROM PUBLIC, anon, authenticated;

-- The quote-number prefix becomes a parameter (default keeps the old format).
DROP FUNCTION app.allocate_quote_number(text, integer);

CREATE FUNCTION app.allocate_quote_number(
  p_service_line text,
  p_year integer,
  p_prefix text DEFAULT 'BJH/Q'
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_value integer;
  code text;
BEGIN
  code := CASE p_service_line
    WHEN 'sea_import' THEN 'SI'
    WHEN 'sea_export' THEN 'SE'
    WHEN 'air_import' THEN 'AI'
    WHEN 'air_export' THEN 'AE'
    ELSE NULL
  END;
  IF code IS NULL THEN
    RAISE EXCEPTION 'unsupported service line: %', p_service_line;
  END IF;

  INSERT INTO app.quote_number_sequence (service_line, sequence_year, last_value)
  VALUES (p_service_line, p_year, 1)
  ON CONFLICT (service_line, sequence_year)
  DO UPDATE SET last_value = app.quote_number_sequence.last_value + 1
  RETURNING last_value INTO next_value;

  RETURN format(
    '%s/%s/%s/%s',
    p_prefix,
    code,
    p_year,
    CASE WHEN next_value < 10000 THEN lpad(next_value::text, 4, '0') ELSE next_value::text END
  );
END;
$$;

REVOKE ALL ON FUNCTION app.allocate_quote_number(text, integer, text)
  FROM PUBLIC, anon, authenticated;
