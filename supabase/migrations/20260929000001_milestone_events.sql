-- Append-only job milestone timeline (B5). A correction is a new event that
-- points at the event it corrects; rows are never updated or deleted.

CREATE TABLE app.milestone_event (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  milestone_key text NOT NULL CHECK (length(milestone_key) BETWEEN 1 AND 80),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES auth.users (id),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'system')),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  correction_of uuid REFERENCES app.milestone_event (event_id)
);

CREATE INDEX milestone_event_job ON app.milestone_event (job_id, occurred_at, recorded_at);

CREATE FUNCTION app.prevent_milestone_event_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'milestone events are append-only';
END;
$$;

REVOKE ALL ON FUNCTION app.prevent_milestone_event_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER milestone_event_append_only
  BEFORE UPDATE OR DELETE ON app.milestone_event
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_milestone_event_change();

ALTER TABLE app.milestone_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.milestone_event FROM PUBLIC, anon, authenticated;
