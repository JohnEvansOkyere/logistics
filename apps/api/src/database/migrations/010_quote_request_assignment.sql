ALTER TABLE quote_request ADD COLUMN assigned_department_role TEXT
  CHECK (assigned_department_role IS NULL OR assigned_department_role IN (
    'air_import_rep', 'air_export_rep', 'sea_import_rep', 'sea_export_rep'
  ));

CREATE TABLE quote_request_assignment_history (
  id TEXT PRIMARY KEY,
  quote_request_id TEXT NOT NULL REFERENCES quote_request (id) ON DELETE CASCADE,
  previous_role TEXT CHECK (previous_role IS NULL OR previous_role IN (
    'air_import_rep', 'air_export_rep', 'sea_import_rep', 'sea_export_rep'
  )),
  assigned_role TEXT CHECK (assigned_role IS NULL OR assigned_role IN (
    'air_import_rep', 'air_export_rep', 'sea_import_rep', 'sea_export_rep'
  )),
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);
