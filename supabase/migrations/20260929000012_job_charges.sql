-- Job charges (F2): what a job is quoted vs what it actually costs.
-- A charge is a service or a disbursement (a third-party cost passed on). Its
-- actual amount is an append-only history: the newest entry is current and a
-- correction is a new entry. An actual in another currency records the
-- exchange rate and the converted amount at that moment.

CREATE TABLE app.job_charge (
  charge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  kind text NOT NULL CHECK (kind IN ('service', 'disbursement')),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 300),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10000),
  unit_quoted_minor bigint CHECK (
    unit_quoted_minor IS NULL OR unit_quoted_minor BETWEEN 0 AND 1000000000000
  ),
  quote_line_id uuid REFERENCES app.quote_line (line_id),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  removed_at timestamptz,
  removed_by uuid REFERENCES auth.users (id),
  CONSTRAINT job_charge_removed_check CHECK (
    (removed_at IS NULL) = (removed_by IS NULL)
  )
);

CREATE INDEX job_charge_job ON app.job_charge (job_id, created_at);

-- Importing a quote line twice must not duplicate the charge.
CREATE UNIQUE INDEX job_charge_one_per_quote_line
  ON app.job_charge (job_id, quote_line_id)
  WHERE quote_line_id IS NOT NULL AND removed_at IS NULL;

CREATE TABLE app.job_charge_actual (
  actual_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL REFERENCES app.job_charge (charge_id),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 0 AND 1000000000000),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(18, 8) CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  -- The amount in the charge's currency, fixed when the entry is recorded.
  converted_minor bigint NOT NULL CHECK (converted_minor BETWEEN 0 AND 1000000000000),
  rate_note text CHECK (rate_note IS NULL OR length(rate_note) <= 200),
  supplier_document_id uuid REFERENCES app.document (document_id),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  correction_of uuid REFERENCES app.job_charge_actual (actual_id),
  recorded_by uuid NOT NULL REFERENCES auth.users (id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX job_charge_actual_charge
  ON app.job_charge_actual (charge_id, recorded_at);

-- Only the removal fields of a charge may change, and only while it has no
-- recorded actual amount.
CREATE FUNCTION app.protect_job_charge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'job charges cannot be deleted; remove them instead';
  END IF;
  IF NEW.job_id IS DISTINCT FROM OLD.job_id
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.quantity IS DISTINCT FROM OLD.quantity
    OR NEW.unit_quoted_minor IS DISTINCT FROM OLD.unit_quoted_minor
    OR NEW.quote_line_id IS DISTINCT FROM OLD.quote_line_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'job charge fields are immutable';
  END IF;
  IF NEW.removed_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM app.job_charge_actual WHERE charge_id = OLD.charge_id
  ) THEN
    RAISE EXCEPTION 'a charge with a recorded actual amount cannot be removed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.protect_job_charge()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER job_charge_protect
  BEFORE UPDATE OR DELETE ON app.job_charge
  FOR EACH ROW
  EXECUTE FUNCTION app.protect_job_charge();

-- An actual is append-only and consistent with its charge: same currency means
-- no rate; a different currency needs one; evidence must be a supplier
-- document on the same job; a correction must point at the same charge.
CREATE FUNCTION app.check_job_charge_actual()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  charge app.job_charge;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'charge actual amounts are append-only';
  END IF;
  SELECT * INTO charge FROM app.job_charge WHERE charge_id = NEW.charge_id;
  IF charge.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'a removed charge cannot receive an actual amount';
  END IF;
  IF NEW.currency = charge.currency THEN
    IF NEW.exchange_rate IS NOT NULL OR NEW.converted_minor <> NEW.amount_minor THEN
      RAISE EXCEPTION 'an actual in the charge currency has no exchange rate';
    END IF;
  ELSIF NEW.exchange_rate IS NULL THEN
    RAISE EXCEPTION 'an actual in another currency needs an exchange rate';
  END IF;
  IF NEW.supplier_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.document
    WHERE document_id = NEW.supplier_document_id
      AND job_id = charge.job_id
      AND document_type IN ('supplier_invoice', 'disbursement_evidence')
  ) THEN
    RAISE EXCEPTION 'evidence must be a supplier invoice or disbursement evidence on the same job';
  END IF;
  IF NEW.correction_of IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.job_charge_actual
    WHERE actual_id = NEW.correction_of AND charge_id = NEW.charge_id
  ) THEN
    RAISE EXCEPTION 'a correction must refer to an earlier amount on the same charge';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.check_job_charge_actual()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER job_charge_actual_check
  BEFORE INSERT OR UPDATE OR DELETE ON app.job_charge_actual
  FOR EACH ROW
  EXECUTE FUNCTION app.check_job_charge_actual();

ALTER TABLE app.job_charge ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.job_charge_actual ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.job_charge, app.job_charge_actual
  FROM PUBLIC, anon, authenticated;
