-- Manual ETA history (E3) and per-job tasks (E4).
-- An ETA change is a new row; the newest row is the current ETA and earlier
-- rows are never edited or deleted. Tasks are assigned to a staff role and can
-- be completed once; exceptions (missing documents, damage, delay) are tasks.

CREATE TABLE app.eta_event (
  eta_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  eta_at timestamptz NOT NULL,
  source text NOT NULL CHECK (length(source) BETWEEN 1 AND 200),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_by uuid NOT NULL REFERENCES auth.users (id),
  correction_of uuid REFERENCES app.eta_event (eta_id)
);

CREATE INDEX eta_event_job ON app.eta_event (job_id, recorded_at);

CREATE FUNCTION app.prevent_eta_event_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'eta events are append-only';
END;
$$;

REVOKE ALL ON FUNCTION app.prevent_eta_event_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER eta_event_append_only
  BEFORE UPDATE OR DELETE ON app.eta_event
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_eta_event_change();

ALTER TABLE app.eta_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.eta_event FROM PUBLIC, anon, authenticated;

CREATE TABLE app.job_task (
  task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  kind text NOT NULL CHECK (kind IN (
    'task', 'missing_documents', 'damage', 'delay', 'other'
  )),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  details text CHECK (details IS NULL OR length(details) <= 2000),
  assigned_role text NOT NULL CHECK (assigned_role IN (
    'super_admin', 'air_import_rep', 'air_export_rep',
    'sea_import_rep', 'sea_export_rep'
  )),
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users (id),
  completion_note text CHECK (
    completion_note IS NULL OR length(completion_note) <= 2000
  ),
  CONSTRAINT job_task_completion_check CHECK (
    (status = 'done') = (completed_at IS NOT NULL AND completed_by IS NOT NULL)
  )
);

CREATE INDEX job_task_job ON app.job_task (job_id, created_at);
CREATE INDEX job_task_open_by_role ON app.job_task (assigned_role, due_date)
  WHERE status = 'open';

ALTER TABLE app.job_task ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.job_task FROM PUBLIC, anon, authenticated;
