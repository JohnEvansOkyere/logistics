-- Drivers, vehicles and deliveries (G1/G2). Drivers and vehicles are plain
-- records that staff assign (drivers do not sign in). A delivery is a numbered
-- waybill on a job; the driver, vehicle and cargo are copied onto it at
-- dispatch and frozen. The proof of delivery is recorded once on the delivery.

CREATE TABLE app.driver (
  driver_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name text NOT NULL CHECK (length(driver_name) BETWEEN 1 AND 160),
  phone text NOT NULL CHECK (length(phone) BETWEEN 1 AND 40),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deactivated_at timestamptz
);

CREATE TABLE app.vehicle (
  vehicle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration text NOT NULL CHECK (length(registration) BETWEEN 1 AND 40),
  description text CHECK (description IS NULL OR length(description) <= 200),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deactivated_at timestamptz
);

CREATE UNIQUE INDEX vehicle_registration_unique
  ON app.vehicle (upper(registration));

CREATE TABLE app.waybill_number_sequence (
  sequence_year integer PRIMARY KEY CHECK (sequence_year BETWEEN 2000 AND 2999),
  last_value integer NOT NULL DEFAULT 0 CHECK (last_value >= 0)
);

CREATE FUNCTION app.allocate_waybill_number(
  p_year integer,
  p_prefix text DEFAULT 'BJH/WB'
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_value integer;
BEGIN
  INSERT INTO app.waybill_number_sequence (sequence_year, last_value)
  VALUES (p_year, 1)
  ON CONFLICT (sequence_year)
  DO UPDATE SET last_value = app.waybill_number_sequence.last_value + 1
  RETURNING last_value INTO next_value;

  RETURN format(
    '%s/%s/%s',
    p_prefix,
    p_year,
    CASE WHEN next_value < 10000 THEN lpad(next_value::text, 4, '0') ELSE next_value::text END
  );
END;
$$;

REVOKE ALL ON FUNCTION app.allocate_waybill_number(integer, text)
  FROM PUBLIC, anon, authenticated;

CREATE TABLE app.delivery (
  delivery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  waybill_number text NOT NULL UNIQUE,
  driver_id uuid NOT NULL REFERENCES app.driver (driver_id),
  vehicle_id uuid NOT NULL REFERENCES app.vehicle (vehicle_id),
  -- Frozen copies: an issued waybill never changes with the records.
  driver_name text NOT NULL,
  driver_phone text NOT NULL,
  vehicle_registration text NOT NULL,
  cargo_description text NOT NULL CHECK (length(cargo_description) BETWEEN 1 AND 500),
  packages integer CHECK (packages IS NULL OR packages BETWEEN 1 AND 1000000),
  gross_weight_kg numeric(12, 2) CHECK (
    gross_weight_kg IS NULL OR gross_weight_kg BETWEEN 0 AND 100000000
  ),
  pickup_location text CHECK (pickup_location IS NULL OR length(pickup_location) <= 300),
  delivery_address text NOT NULL CHECK (length(delivery_address) BETWEEN 1 AND 500),
  dispatched_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  dispatched_by uuid NOT NULL REFERENCES auth.users (id),
  status text NOT NULL DEFAULT 'dispatched' CHECK (status IN ('dispatched', 'delivered')),
  -- Proof of delivery, recorded once.
  receiver_name text CHECK (receiver_name IS NULL OR length(receiver_name) BETWEEN 1 AND 160),
  receiver_phone text CHECK (receiver_phone IS NULL OR length(receiver_phone) <= 40),
  delivered_at timestamptz,
  damage_notes text CHECK (damage_notes IS NULL OR length(damage_notes) <= 2000),
  pod_document_id uuid REFERENCES app.document (document_id),
  pod_recorded_by uuid REFERENCES auth.users (id),
  pod_recorded_at timestamptz,
  CONSTRAINT delivery_pod_check CHECK (
    (status = 'delivered') = (
      receiver_name IS NOT NULL AND delivered_at IS NOT NULL
      AND pod_recorded_by IS NOT NULL AND pod_recorded_at IS NOT NULL
    )
  )
);

CREATE INDEX delivery_job ON app.delivery (job_id, dispatched_at);

CREATE FUNCTION app.protect_delivery()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'deliveries cannot be deleted';
  END IF;
  IF NEW.job_id IS DISTINCT FROM OLD.job_id
    OR NEW.waybill_number IS DISTINCT FROM OLD.waybill_number
    OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
    OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
    OR NEW.driver_name IS DISTINCT FROM OLD.driver_name
    OR NEW.driver_phone IS DISTINCT FROM OLD.driver_phone
    OR NEW.vehicle_registration IS DISTINCT FROM OLD.vehicle_registration
    OR NEW.cargo_description IS DISTINCT FROM OLD.cargo_description
    OR NEW.packages IS DISTINCT FROM OLD.packages
    OR NEW.gross_weight_kg IS DISTINCT FROM OLD.gross_weight_kg
    OR NEW.pickup_location IS DISTINCT FROM OLD.pickup_location
    OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
    OR NEW.dispatched_at IS DISTINCT FROM OLD.dispatched_at
    OR NEW.dispatched_by IS DISTINCT FROM OLD.dispatched_by THEN
    RAISE EXCEPTION 'an issued waybill is immutable';
  END IF;
  IF OLD.status = 'delivered' THEN
    RAISE EXCEPTION 'the proof of delivery is already recorded';
  END IF;
  IF NEW.pod_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.document
    WHERE document_id = NEW.pod_document_id
      AND job_id = OLD.job_id
      AND document_type = 'delivery_note'
  ) THEN
    RAISE EXCEPTION 'the proof of delivery document must be a delivery note on the same job';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.protect_delivery()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER delivery_protect
  BEFORE UPDATE OR DELETE ON app.delivery
  FOR EACH ROW
  EXECUTE FUNCTION app.protect_delivery();

ALTER TABLE app.driver ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.vehicle ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.waybill_number_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
  app.driver, app.vehicle, app.waybill_number_sequence, app.delivery
FROM PUBLIC, anon, authenticated;
