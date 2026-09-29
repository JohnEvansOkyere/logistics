-- Quote acceptance / rejection (D3) and the one-job-per-quote link (D4).
-- A decision is recorded by staff on the client's behalf against one issued
-- version, with the client's named signatory. Decisions are append-only; a
-- version is decided once, and a quote is accepted at most once. An accepted
-- quote can no longer be revised, and opens at most one job.

ALTER TABLE app.quote_version
  ADD CONSTRAINT quote_version_id_quote_unique UNIQUE (version_id, quote_id);

CREATE TABLE app.quote_decision (
  decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  version_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted', 'rejected')),
  client_signatory text NOT NULL CHECK (length(client_signatory) BETWEEN 1 AND 160),
  decided_at timestamptz NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 2000),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_by uuid NOT NULL REFERENCES auth.users (id),
  FOREIGN KEY (version_id, quote_id)
    REFERENCES app.quote_version (version_id, quote_id),
  UNIQUE (version_id)
);

CREATE UNIQUE INDEX quote_decision_one_acceptance
  ON app.quote_decision (quote_id) WHERE decision = 'accepted';

CREATE FUNCTION app.check_quote_decision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'quote decisions are append-only';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.quote_version
    WHERE version_id = NEW.version_id AND status = 'issued'
  ) THEN
    RAISE EXCEPTION 'only an issued quote version can be accepted or rejected';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.check_quote_decision()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_decision_check
  BEFORE INSERT OR UPDATE OR DELETE ON app.quote_decision
  FOR EACH ROW
  EXECUTE FUNCTION app.check_quote_decision();

-- Once accepted, a quote can gain no new version and issue no draft.
CREATE FUNCTION app.block_revision_of_accepted_quote()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.status = 'issued') AND EXISTS (
    SELECT 1 FROM app.quote_decision
    WHERE quote_id = NEW.quote_id AND decision = 'accepted'
  ) THEN
    RAISE EXCEPTION 'an accepted quote cannot be revised';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.block_revision_of_accepted_quote()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_version_block_accepted
  BEFORE INSERT OR UPDATE ON app.quote_version
  FOR EACH ROW
  EXECUTE FUNCTION app.block_revision_of_accepted_quote();

ALTER TABLE app.quote_decision ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.quote_decision FROM PUBLIC, anon, authenticated;

-- At most one job per quote.
ALTER TABLE app.job
  ADD COLUMN quote_id uuid UNIQUE REFERENCES app.quote (quote_id);
