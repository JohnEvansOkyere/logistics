-- Job status workflow (B6): open → in_progress → on_hold → ready_to_close →
-- closed / cancelled, with an append-only history of every change.

ALTER TABLE app.job DROP CONSTRAINT job_status_check;
ALTER TABLE app.job DROP CONSTRAINT job_check;

ALTER TABLE app.job
  ADD CONSTRAINT job_status_check CHECK (status IN (
    'open', 'in_progress', 'on_hold', 'ready_to_close', 'closed', 'cancelled'
  )),
  ADD CONSTRAINT job_closed_at_check CHECK (
    (status IN ('closed', 'cancelled')) = (closed_at IS NOT NULL)
  );

CREATE TABLE app.job_status_history (
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text CHECK (reason IS NULL OR length(reason) <= 2000),
  changed_by uuid NOT NULL REFERENCES auth.users (id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_status_history_job ON app.job_status_history (job_id, changed_at);

CREATE FUNCTION app.prevent_job_status_history_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'job status history is append-only';
END;
$$;

REVOKE ALL ON FUNCTION app.prevent_job_status_history_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER job_status_history_append_only
  BEFORE UPDATE OR DELETE ON app.job_status_history
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_job_status_history_change();

ALTER TABLE app.job_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.job_status_history FROM PUBLIC, anon, authenticated;
