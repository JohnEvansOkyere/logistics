-- Receipts (F5): every payment recorded from now on gets a unique receipt
-- number, allocated in the same transaction as the payment. The receipt is a
-- plain acknowledgement of a payment staff recorded; it never says a bank
-- verified anything. Older rows recorded before this migration have no number.

CREATE TABLE app.receipt_number_sequence (
  sequence_year integer PRIMARY KEY CHECK (sequence_year BETWEEN 2000 AND 2999),
  last_value integer NOT NULL DEFAULT 0 CHECK (last_value >= 0)
);

CREATE FUNCTION app.allocate_receipt_number(
  p_year integer,
  p_prefix text DEFAULT 'BJH/RCT'
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_value integer;
BEGIN
  INSERT INTO app.receipt_number_sequence (sequence_year, last_value)
  VALUES (p_year, 1)
  ON CONFLICT (sequence_year)
  DO UPDATE SET last_value = app.receipt_number_sequence.last_value + 1
  RETURNING last_value INTO next_value;

  RETURN format(
    '%s/%s/%s',
    p_prefix,
    p_year,
    CASE WHEN next_value < 10000 THEN lpad(next_value::text, 4, '0') ELSE next_value::text END
  );
END;
$$;

REVOKE ALL ON FUNCTION app.allocate_receipt_number(integer, text)
  FROM PUBLIC, anon, authenticated;

ALTER TABLE app.invoice_payment ADD COLUMN receipt_number text UNIQUE;

ALTER TABLE app.receipt_number_sequence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.receipt_number_sequence FROM PUBLIC, anon, authenticated;
