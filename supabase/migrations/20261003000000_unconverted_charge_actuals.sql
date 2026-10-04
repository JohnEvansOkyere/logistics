-- Keep an actual cost in the currency staff recorded. Existing converted
-- history remains immutable; new cross-currency entries have no converted sum.
ALTER TABLE app.job_charge_actual
  ALTER COLUMN converted_minor DROP NOT NULL;

CREATE OR REPLACE FUNCTION app.check_job_charge_actual()
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
    IF NEW.exchange_rate IS NOT NULL OR NEW.converted_minor IS DISTINCT FROM NEW.amount_minor THEN
      RAISE EXCEPTION 'an actual in the charge currency has no exchange rate';
    END IF;
  ELSIF NEW.exchange_rate IS NULL AND NEW.converted_minor IS NOT NULL THEN
    RAISE EXCEPTION 'an unconverted actual cannot have a converted amount';
  ELSIF NEW.exchange_rate IS NOT NULL AND NEW.converted_minor IS NULL THEN
    RAISE EXCEPTION 'a converted actual needs a converted amount';
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
