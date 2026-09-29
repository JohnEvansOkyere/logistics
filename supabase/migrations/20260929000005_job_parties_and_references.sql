-- Job parties (shipper, consignee, notify party, agents) and shipment
-- references with a master/house hierarchy (B4). Rows are soft-removed so the
-- record of what was on a job is kept.

CREATE TABLE app.job_party (
  party_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  role text NOT NULL CHECK (role IN ('shipper', 'consignee', 'notify_party', 'agent')),
  party_name text NOT NULL CHECK (length(party_name) BETWEEN 1 AND 200),
  details text CHECK (details IS NULL OR length(details) <= 1000),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  removed_by uuid REFERENCES auth.users (id),
  removed_at timestamptz,
  CHECK ((removed_by IS NULL) = (removed_at IS NULL))
);

CREATE INDEX job_party_job ON app.job_party (job_id) WHERE removed_at IS NULL;

CREATE TABLE app.shipment_reference (
  reference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  kind text NOT NULL CHECK (kind IN (
    'master_bl', 'house_bl', 'master_awb', 'house_awb', 'booking', 'container'
  )),
  reference_value text NOT NULL CHECK (length(reference_value) BETWEEN 1 AND 80),
  seal_number text CHECK (seal_number IS NULL OR (kind = 'container' AND length(seal_number) <= 80)),
  parent_reference_id uuid REFERENCES app.shipment_reference (reference_id),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  removed_by uuid REFERENCES auth.users (id),
  removed_at timestamptz,
  CHECK ((removed_by IS NULL) = (removed_at IS NULL)),
  CHECK (parent_reference_id IS NULL OR kind IN ('house_bl', 'house_awb'))
);

CREATE UNIQUE INDEX shipment_reference_unique_active
  ON app.shipment_reference (job_id, kind, lower(reference_value))
  WHERE removed_at IS NULL;
CREATE INDEX shipment_reference_job ON app.shipment_reference (job_id) WHERE removed_at IS NULL;
CREATE INDEX shipment_reference_value ON app.shipment_reference (lower(reference_value));

-- A house document may only hang under a master of the matching kind on the same job.
CREATE FUNCTION app.check_shipment_reference_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent app.shipment_reference;
BEGIN
  IF NEW.parent_reference_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO parent FROM app.shipment_reference
    WHERE reference_id = NEW.parent_reference_id;
  IF parent.job_id IS DISTINCT FROM NEW.job_id
    OR parent.removed_at IS NOT NULL
    OR NOT (
      (NEW.kind = 'house_bl' AND parent.kind = 'master_bl')
      OR (NEW.kind = 'house_awb' AND parent.kind = 'master_awb')
    ) THEN
    RAISE EXCEPTION 'house reference must belong to an active master of the same job';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.check_shipment_reference_parent()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER shipment_reference_parent_check
  BEFORE INSERT ON app.shipment_reference
  FOR EACH ROW
  EXECUTE FUNCTION app.check_shipment_reference_parent();

ALTER TABLE app.job_party ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.shipment_reference ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.job_party, app.shipment_reference
  FROM PUBLIC, anon, authenticated;
