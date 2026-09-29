-- Job file core (B2). File numbers use BJH/{SI|SE|AI|AE}/{YYYY}/{seq}; the
-- sequence restarts every year per service line and is allocated atomically.

CREATE TABLE app.job_number_sequence (
  service_line text NOT NULL CHECK (service_line IN (
    'sea_import', 'sea_export', 'air_import', 'air_export'
  )),
  sequence_year integer NOT NULL CHECK (sequence_year BETWEEN 2000 AND 2999),
  last_value integer NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (service_line, sequence_year)
);

CREATE TABLE app.job (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_number text NOT NULL UNIQUE,
  service_line text NOT NULL CHECK (service_line IN (
    'sea_import', 'sea_export', 'air_import', 'air_export'
  )),
  customer_company_id uuid NOT NULL REFERENCES app.customer_company (company_id),
  quote_request_id uuid REFERENCES app.quote_request (request_id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  opened_by uuid NOT NULL REFERENCES auth.users (id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK ((status = 'open') = (closed_at IS NULL))
);

CREATE INDEX job_customer_company ON app.job (customer_company_id, opened_at DESC);
CREATE INDEX job_service_line ON app.job (service_line, opened_at DESC);

-- Returns the next unique file number. Row-level locking in the upsert makes
-- concurrent callers wait for each other, so numbers are never reused.
CREATE FUNCTION app.allocate_job_number(p_service_line text, p_year integer)
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

  INSERT INTO app.job_number_sequence (service_line, sequence_year, last_value)
  VALUES (p_service_line, p_year, 1)
  ON CONFLICT (service_line, sequence_year)
  DO UPDATE SET last_value = app.job_number_sequence.last_value + 1
  RETURNING last_value INTO next_value;

  RETURN format(
    'BJH/%s/%s/%s',
    code,
    p_year,
    CASE WHEN next_value < 10000 THEN lpad(next_value::text, 4, '0') ELSE next_value::text END
  );
END;
$$;

CREATE FUNCTION app.prevent_job_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.file_number IS DISTINCT FROM OLD.file_number
    OR NEW.service_line IS DISTINCT FROM OLD.service_line
    OR NEW.customer_company_id IS DISTINCT FROM OLD.customer_company_id
    OR NEW.opened_by IS DISTINCT FROM OLD.opened_by
    OR NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
    RAISE EXCEPTION 'job identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER job_identity_immutable
  BEFORE UPDATE ON app.job
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_job_identity_change();

REVOKE ALL ON FUNCTION app.allocate_job_number(text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.prevent_job_identity_change()
  FROM PUBLIC, anon, authenticated;

ALTER TABLE app.job ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.job_number_sequence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.job, app.job_number_sequence
  FROM PUBLIC, anon, authenticated;
