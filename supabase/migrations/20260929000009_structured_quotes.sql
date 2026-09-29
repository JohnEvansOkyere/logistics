-- Structured quotations (D1/D2). A quote belongs to a customer company and a
-- service line; its content lives in versions. A draft version is editable;
-- issuing freezes it and makes it visible to the customer. A change after
-- issue is a new version. The quote number is allocated at first issue.

CREATE TABLE app.quote_number_sequence (
  service_line text NOT NULL CHECK (service_line IN (
    'sea_import', 'sea_export', 'air_import', 'air_export'
  )),
  sequence_year integer NOT NULL CHECK (sequence_year BETWEEN 2000 AND 2999),
  last_value integer NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (service_line, sequence_year)
);

CREATE FUNCTION app.allocate_quote_number(p_service_line text, p_year integer)
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
    'BJH/Q/%s/%s/%s',
    code,
    p_year,
    CASE WHEN next_value < 10000 THEN lpad(next_value::text, 4, '0') ELSE next_value::text END
  );
END;
$$;

REVOKE ALL ON FUNCTION app.allocate_quote_number(text, integer)
  FROM PUBLIC, anon, authenticated;

CREATE TABLE app.quote (
  quote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE,
  service_line text NOT NULL CHECK (service_line IN (
    'sea_import', 'sea_export', 'air_import', 'air_export'
  )),
  customer_company_id uuid NOT NULL REFERENCES app.customer_company (company_id),
  quote_request_id uuid REFERENCES app.quote_request (request_id),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX quote_customer_company ON app.quote (customer_company_id, created_at DESC);
CREATE INDEX quote_service_line ON app.quote (service_line, created_at DESC);

CREATE FUNCTION app.prevent_quote_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.service_line IS DISTINCT FROM OLD.service_line
    OR NEW.customer_company_id IS DISTINCT FROM OLD.customer_company_id
    OR NEW.quote_request_id IS DISTINCT FROM OLD.quote_request_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.quote_number IS NOT NULL
        AND NEW.quote_number IS DISTINCT FROM OLD.quote_number) THEN
    RAISE EXCEPTION 'quote identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.prevent_quote_identity_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_identity_immutable
  BEFORE UPDATE ON app.quote
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_quote_identity_change();

CREATE TABLE app.quote_version (
  version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES app.quote (quote_id),
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  subtitle text CHECK (subtitle IS NULL OR length(subtitle) <= 200),
  shipment_scope text CHECK (shipment_scope IS NULL OR length(shipment_scope) <= 500),
  intro text CHECK (intro IS NULL OR length(intro) <= 4000),
  at_cost_note text CHECK (at_cost_note IS NULL OR length(at_cost_note) <= 2000),
  procedure_steps text[] NOT NULL DEFAULT '{}',
  required_documents text[] NOT NULL DEFAULT '{}',
  documents_note text CHECK (documents_note IS NULL OR length(documents_note) <= 2000),
  timeline text CHECK (timeline IS NULL OR length(timeline) <= 2000),
  terms text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  issued_by uuid REFERENCES auth.users (id),
  issued_at timestamptz,
  UNIQUE (quote_id, version_number),
  CONSTRAINT quote_version_issued_check CHECK (
    (status = 'issued') = (issued_at IS NOT NULL AND issued_by IS NOT NULL)
  )
);

-- A quote has at most one draft at a time.
CREATE UNIQUE INDEX quote_version_one_draft
  ON app.quote_version (quote_id) WHERE status = 'draft';

CREATE TABLE app.quote_line (
  line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES app.quote_version (version_id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  section text CHECK (section IS NULL OR length(section) <= 200),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 300),
  basis text NOT NULL CHECK (basis IN ('fixed', 'per_bl', 'per_container', 'at_cost')),
  basis_note text CHECK (basis_note IS NULL OR length(basis_note) <= 300),
  amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor BETWEEN 0 AND 1000000000000),
  amount_20ft_minor bigint CHECK (amount_20ft_minor IS NULL OR amount_20ft_minor BETWEEN 0 AND 1000000000000),
  amount_40ft_minor bigint CHECK (amount_40ft_minor IS NULL OR amount_40ft_minor BETWEEN 0 AND 1000000000000),
  UNIQUE (version_id, position),
  -- One amount, or a 20ft and a 40ft amount together; never both forms.
  CONSTRAINT quote_line_amount_form CHECK (
    (amount_20ft_minor IS NULL) = (amount_40ft_minor IS NULL)
    AND (amount_minor IS NULL OR amount_20ft_minor IS NULL)
  ),
  -- Only at-cost lines may omit the amount (the actual invoice sets it).
  CONSTRAINT quote_line_amount_required CHECK (
    basis = 'at_cost'
    OR amount_minor IS NOT NULL
    OR amount_20ft_minor IS NOT NULL
  )
);

CREATE FUNCTION app.protect_issued_quote_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'issued' THEN
    RAISE EXCEPTION 'issued quote versions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.quote_id IS DISTINCT FROM OLD.quote_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'quote version identity fields are immutable';
  END IF;
  IF NEW.status = 'issued' AND NOT EXISTS (
    SELECT 1 FROM app.quote_line WHERE version_id = OLD.version_id
  ) THEN
    RAISE EXCEPTION 'a quote version needs at least one charge line to be issued';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.protect_issued_quote_version()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_version_protect_issued
  BEFORE UPDATE OR DELETE ON app.quote_version
  FOR EACH ROW
  EXECUTE FUNCTION app.protect_issued_quote_version();

-- Lines of an issued version can be neither added, changed nor removed.
CREATE FUNCTION app.protect_issued_quote_lines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status
  FROM app.quote_version
  WHERE version_id = CASE WHEN TG_OP = 'INSERT' THEN NEW.version_id ELSE OLD.version_id END;
  -- No parent row: the version itself is being deleted (draft cascade).
  IF parent_status IS NOT NULL AND parent_status <> 'draft' THEN
    RAISE EXCEPTION 'lines of an issued quote version are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION app.protect_issued_quote_lines()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_line_protect_issued
  BEFORE INSERT OR UPDATE OR DELETE ON app.quote_line
  FOR EACH ROW
  EXECUTE FUNCTION app.protect_issued_quote_lines();

ALTER TABLE app.quote_number_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quote ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quote_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quote_line ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  app.quote_number_sequence, app.quote, app.quote_version, app.quote_line
FROM PUBLIC, anon, authenticated;
