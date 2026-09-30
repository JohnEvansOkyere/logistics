-- Customer invoices (F3) and staff-recorded external payments (F4).
-- An invoice belongs to a job. It is a draft until issued; issuing allocates
-- its number and freezes lines, tax lines and totals. An issued invoice never
-- changes: a mistake is corrected by voiding it and issuing a new one.
-- A payment is received outside the system; it is append-only and a mistake
-- is a reversal with a reason. The balance is always derived from the ledger.

CREATE TABLE app.invoice_number_sequence (
  sequence_year integer PRIMARY KEY CHECK (sequence_year BETWEEN 2000 AND 2999),
  last_value integer NOT NULL DEFAULT 0 CHECK (last_value >= 0)
);

CREATE FUNCTION app.allocate_invoice_number(
  p_year integer,
  p_prefix text DEFAULT 'BJH/INV'
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_value integer;
BEGIN
  INSERT INTO app.invoice_number_sequence (sequence_year, last_value)
  VALUES (p_year, 1)
  ON CONFLICT (sequence_year)
  DO UPDATE SET last_value = app.invoice_number_sequence.last_value + 1
  RETURNING last_value INTO next_value;

  RETURN format(
    '%s/%s/%s',
    p_prefix,
    p_year,
    CASE WHEN next_value < 10000 THEN lpad(next_value::text, 4, '0') ELSE next_value::text END
  );
END;
$$;

REVOKE ALL ON FUNCTION app.allocate_invoice_number(integer, text)
  FROM PUBLIC, anon, authenticated;

CREATE TABLE app.invoice (
  invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  -- Allocated when the invoice is issued, so drafts leave no gaps.
  invoice_number text UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'void')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  -- [{description, amountMinor, taxable}]
  lines jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lines) = 'array'),
  due_date date,
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  subtotal_minor bigint NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  -- [{name, rateBasisPoints, amountMinor}], copied from the settings.
  tax_lines jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tax_lines) = 'array'),
  tax_total_minor bigint NOT NULL DEFAULT 0 CHECK (tax_total_minor >= 0),
  total_minor bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  issued_by uuid REFERENCES auth.users (id),
  issued_at timestamptz,
  voided_by uuid REFERENCES auth.users (id),
  voided_at timestamptz,
  void_reason text CHECK (void_reason IS NULL OR length(void_reason) BETWEEN 1 AND 500),
  CONSTRAINT invoice_total_check CHECK (total_minor = subtotal_minor + tax_total_minor),
  CONSTRAINT invoice_issue_check CHECK (
    (invoice_number IS NULL) = (issued_at IS NULL)
    AND (issued_by IS NULL) = (issued_at IS NULL)
    AND (status <> 'issued' OR issued_at IS NOT NULL)
    AND (status <> 'draft' OR issued_at IS NULL)
    AND (issued_at IS NULL OR jsonb_array_length(lines) >= 1)
  ),
  CONSTRAINT invoice_void_check CHECK (
    (status = 'void') = (voided_at IS NOT NULL)
    AND (voided_at IS NULL) = (voided_by IS NULL)
    AND (voided_at IS NULL) = (void_reason IS NULL)
  )
);

CREATE INDEX invoice_job ON app.invoice (job_id, created_at);

CREATE TABLE app.invoice_payment (
  payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES app.invoice (invoice_id),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 1000000000000),
  received_on date NOT NULL,
  method text NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'cheque', 'mobile_money', 'other')),
  reference text CHECK (reference IS NULL OR length(reference) <= 200),
  evidence_document_id uuid REFERENCES app.document (document_id),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  recorded_by uuid NOT NULL REFERENCES auth.users (id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX invoice_payment_invoice ON app.invoice_payment (invoice_id, recorded_at);

-- One reversal per payment; the payment row itself never changes.
CREATE TABLE app.invoice_payment_reversal (
  payment_id uuid PRIMARY KEY REFERENCES app.invoice_payment (payment_id),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  reversed_by uuid NOT NULL REFERENCES auth.users (id),
  reversed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- A draft can be edited, issued or voided. An issued invoice can only be
-- voided, and only when no payment is still standing against it.
CREATE FUNCTION app.protect_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'invoices cannot be deleted; void them instead';
  END IF;
  IF OLD.status = 'void' THEN
    RAISE EXCEPTION 'a voided invoice cannot change';
  END IF;
  IF NEW.job_id IS DISTINCT FROM OLD.job_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'invoice identity fields are immutable';
  END IF;
  IF OLD.status = 'issued' THEN
    IF NEW.status <> 'void' THEN
      RAISE EXCEPTION 'an issued invoice is immutable';
    END IF;
    IF ROW(NEW.invoice_number, NEW.currency, NEW.lines, NEW.due_date, NEW.notes,
           NEW.subtotal_minor, NEW.tax_lines, NEW.tax_total_minor, NEW.total_minor,
           NEW.issued_by, NEW.issued_at)
       IS DISTINCT FROM
       ROW(OLD.invoice_number, OLD.currency, OLD.lines, OLD.due_date, OLD.notes,
           OLD.subtotal_minor, OLD.tax_lines, OLD.tax_total_minor, OLD.total_minor,
           OLD.issued_by, OLD.issued_at) THEN
      RAISE EXCEPTION 'an issued invoice is immutable';
    END IF;
    IF EXISTS (
      SELECT 1 FROM app.invoice_payment p
      WHERE p.invoice_id = OLD.invoice_id
        AND NOT EXISTS (
          SELECT 1 FROM app.invoice_payment_reversal r WHERE r.payment_id = p.payment_id
        )
    ) THEN
      RAISE EXCEPTION 'reverse the payments before voiding the invoice';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.protect_invoice() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER invoice_protect
  BEFORE UPDATE OR DELETE ON app.invoice
  FOR EACH ROW
  EXECUTE FUNCTION app.protect_invoice();

-- A payment needs an issued invoice, never takes the standing payments above
-- the invoice total, and any evidence is a document on the invoice's job. The
-- invoice row is locked so simultaneous payments cannot over-allocate.
CREATE FUNCTION app.check_invoice_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  target app.invoice;
  standing bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'payments are append-only; reverse a mistaken payment';
  END IF;
  SELECT * INTO target FROM app.invoice WHERE invoice_id = NEW.invoice_id FOR UPDATE;
  IF target.status <> 'issued' THEN
    RAISE EXCEPTION 'payments can only be recorded against an issued invoice';
  END IF;
  SELECT COALESCE(sum(p.amount_minor), 0) INTO standing
  FROM app.invoice_payment p
  WHERE p.invoice_id = NEW.invoice_id
    AND NOT EXISTS (
      SELECT 1 FROM app.invoice_payment_reversal r WHERE r.payment_id = p.payment_id
    );
  IF standing + NEW.amount_minor > target.total_minor THEN
    RAISE EXCEPTION 'payment exceeds the outstanding balance';
  END IF;
  IF NEW.evidence_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.document
    WHERE document_id = NEW.evidence_document_id AND job_id = target.job_id
  ) THEN
    RAISE EXCEPTION 'evidence must be a document on the same job';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.check_invoice_payment() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER invoice_payment_check
  BEFORE INSERT OR UPDATE OR DELETE ON app.invoice_payment
  FOR EACH ROW
  EXECUTE FUNCTION app.check_invoice_payment();

CREATE FUNCTION app.protect_payment_reversal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'payment reversals are append-only';
END;
$$;

REVOKE ALL ON FUNCTION app.protect_payment_reversal() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER invoice_payment_reversal_protect
  BEFORE UPDATE OR DELETE ON app.invoice_payment_reversal
  FOR EACH ROW
  EXECUTE FUNCTION app.protect_payment_reversal();

ALTER TABLE app.invoice_number_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.invoice_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.invoice_payment_reversal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  app.invoice_number_sequence, app.invoice, app.invoice_payment,
  app.invoice_payment_reversal
  FROM PUBLIC, anon, authenticated;
