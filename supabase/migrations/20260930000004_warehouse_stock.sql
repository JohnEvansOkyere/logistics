-- Light warehousing (I4): named locations and an append-only ledger of goods
-- received and released on a warehousing job. Balance is receipts minus
-- releases per job, location, item and unit, at any date. A release can never
-- make the balance negative at any point in time, including backdated entries
-- (that is what a running total over the dated ledger checks). This is a simple
-- goods-in / goods-out record, not a full inventory system.

CREATE TABLE app.warehouse_location (
  location_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name text NOT NULL CHECK (length(location_name) BETWEEN 1 AND 120),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deactivated_at timestamptz
);

CREATE UNIQUE INDEX warehouse_location_name_unique
  ON app.warehouse_location (lower(location_name));

CREATE TABLE app.stock_movement (
  movement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  location_id uuid NOT NULL REFERENCES app.warehouse_location (location_id),
  kind text NOT NULL CHECK (kind IN ('receipt', 'release')),
  item text NOT NULL CHECK (length(item) BETWEEN 1 AND 200),
  unit text NOT NULL DEFAULT 'units' CHECK (length(unit) BETWEEN 1 AND 40),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100000000),
  -- Condition of the goods and any handling discrepancy noticed.
  condition_notes text CHECK (condition_notes IS NULL OR length(condition_notes) <= 2000),
  -- A delivery note, waybill or release order number.
  reference text CHECK (reference IS NULL OR length(reference) <= 200),
  occurred_at timestamptz NOT NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users (id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX stock_movement_job ON app.stock_movement (job_id, occurred_at);
CREATE INDEX stock_movement_location ON app.stock_movement (location_id);

-- Append-only; only a warehousing job takes stock; the location must be in
-- use; and the running balance of the job/location/item/unit stays at or above
-- zero at every point in time. Movements of one item are serialised with an
-- advisory lock so simultaneous releases cannot both pass.
CREATE FUNCTION app.check_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  lowest bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'stock movements are append-only';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.job WHERE job_id = NEW.job_id AND service_line = 'warehousing'
  ) THEN
    RAISE EXCEPTION 'stock is recorded on a warehousing job';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.warehouse_location
    WHERE location_id = NEW.location_id AND deactivated_at IS NULL
  ) THEN
    RAISE EXCEPTION 'the warehouse location is not in use';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.job_id::text || '|' || NEW.location_id::text || '|'
      || lower(btrim(NEW.item)) || '|' || lower(btrim(NEW.unit)), 0));

  SELECT min(running) INTO lowest
  FROM (
    SELECT sum(delta) OVER (
      ORDER BY occurred_at, is_release, recorded_at, movement_id
    ) AS running
    FROM (
      SELECT movement_id, occurred_at, recorded_at, (kind = 'release') AS is_release,
             CASE WHEN kind = 'receipt' THEN quantity ELSE -quantity END AS delta
      FROM app.stock_movement
      WHERE job_id = NEW.job_id AND location_id = NEW.location_id
        AND lower(btrim(item)) = lower(btrim(NEW.item))
        AND lower(btrim(unit)) = lower(btrim(NEW.unit))
      UNION ALL
      SELECT NEW.movement_id, NEW.occurred_at, clock_timestamp(), (NEW.kind = 'release'),
             CASE WHEN NEW.kind = 'receipt' THEN NEW.quantity ELSE -NEW.quantity END
    ) AS ledger
  ) AS balances;

  IF lowest < 0 THEN
    RAISE EXCEPTION 'insufficient stock: the balance cannot go below zero';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.check_stock_movement() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER stock_movement_check
  BEFORE INSERT OR UPDATE OR DELETE ON app.stock_movement
  FOR EACH ROW
  EXECUTE FUNCTION app.check_stock_movement();

ALTER TABLE app.warehouse_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.stock_movement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.warehouse_location, app.stock_movement
  FROM PUBLIC, anon, authenticated;
