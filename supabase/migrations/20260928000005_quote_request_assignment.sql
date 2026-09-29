ALTER TABLE app.quote_request
  ADD COLUMN assigned_department_role text
    CHECK (assigned_department_role IS NULL OR assigned_department_role IN (
      'air_import_rep', 'air_export_rep', 'sea_import_rep', 'sea_export_rep'
    ));

CREATE TABLE app.quote_request_assignment_history (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES app.quote_request (request_id) ON DELETE CASCADE,
  previous_role text CHECK (previous_role IS NULL OR previous_role IN (
    'air_import_rep', 'air_export_rep', 'sea_import_rep', 'sea_export_rep'
  )),
  assigned_role text CHECK (assigned_role IS NULL OR assigned_role IN (
    'air_import_rep', 'air_export_rep', 'sea_import_rep', 'sea_export_rep'
  )),
  assigned_by uuid NOT NULL REFERENCES auth.users (id),
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_request_assignment_history_request
  ON app.quote_request_assignment_history (request_id, assigned_at DESC);

CREATE FUNCTION app.prevent_quote_request_assignment_history_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'quote request assignment history is immutable';
END;
$$;

REVOKE ALL ON FUNCTION app.prevent_quote_request_assignment_history_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_request_assignment_history_immutable
  BEFORE UPDATE OR DELETE ON app.quote_request_assignment_history
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_quote_request_assignment_history_change();

ALTER TABLE app.quote_request_assignment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.quote_request_assignment_history
  FROM PUBLIC, anon, authenticated;
