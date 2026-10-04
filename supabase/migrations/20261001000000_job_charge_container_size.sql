-- Preserve the selected quote-size rate on each imported job charge so a
-- mixed-size shipment can import a quote once for every size it contains.
ALTER TABLE app.job_charge
  ADD COLUMN quote_container_size text
    CHECK (quote_container_size IS NULL OR length(quote_container_size) BETWEEN 1 AND 30),
  ADD CONSTRAINT job_charge_quote_size_requires_quote_line
    CHECK (quote_container_size IS NULL OR quote_line_id IS NOT NULL);

DROP INDEX app.job_charge_one_per_quote_line;

CREATE UNIQUE INDEX job_charge_one_per_quote_line
  ON app.job_charge (job_id, quote_line_id)
  WHERE quote_line_id IS NOT NULL
    AND quote_container_size IS NULL
    AND removed_at IS NULL;

CREATE UNIQUE INDEX job_charge_one_per_quote_line_size
  ON app.job_charge (job_id, quote_line_id, lower(quote_container_size))
  WHERE quote_line_id IS NOT NULL
    AND quote_container_size IS NOT NULL
    AND removed_at IS NULL;

CREATE OR REPLACE FUNCTION app.protect_job_charge()
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
    OR NEW.quote_container_size IS DISTINCT FROM OLD.quote_container_size
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
