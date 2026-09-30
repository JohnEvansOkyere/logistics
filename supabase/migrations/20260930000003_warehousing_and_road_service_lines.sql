-- Two more service lines: warehousing (WH) and standalone road transport (RT).
-- Jobs, job numbers, quotes and quote numbers accept them; file numbers are
-- BJH/WH/{YYYY}/{seq} and BJH/RT/{YYYY}/{seq}. They are shared work: every
-- department representative can open and see them (no separate role).

ALTER TABLE app.job_number_sequence DROP CONSTRAINT job_number_sequence_service_line_check;
ALTER TABLE app.job_number_sequence ADD CONSTRAINT job_number_sequence_service_line_check
  CHECK (service_line IN (
    'sea_import', 'sea_export', 'air_import', 'air_export', 'warehousing', 'road_transport'
  ));

ALTER TABLE app.job DROP CONSTRAINT job_service_line_check;
ALTER TABLE app.job ADD CONSTRAINT job_service_line_check
  CHECK (service_line IN (
    'sea_import', 'sea_export', 'air_import', 'air_export', 'warehousing', 'road_transport'
  ));

ALTER TABLE app.quote_number_sequence DROP CONSTRAINT quote_number_sequence_service_line_check;
ALTER TABLE app.quote_number_sequence ADD CONSTRAINT quote_number_sequence_service_line_check
  CHECK (service_line IN (
    'sea_import', 'sea_export', 'air_import', 'air_export', 'warehousing', 'road_transport'
  ));

ALTER TABLE app.quote DROP CONSTRAINT quote_service_line_check;
ALTER TABLE app.quote ADD CONSTRAINT quote_service_line_check
  CHECK (service_line IN (
    'sea_import', 'sea_export', 'air_import', 'air_export', 'warehousing', 'road_transport'
  ));

CREATE OR REPLACE FUNCTION app.allocate_job_number(p_service_line text, p_year integer)
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
    WHEN 'warehousing' THEN 'WH'
    WHEN 'road_transport' THEN 'RT'
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

CREATE OR REPLACE FUNCTION app.allocate_quote_number(
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
    WHEN 'warehousing' THEN 'WH'
    WHEN 'road_transport' THEN 'RT'
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
