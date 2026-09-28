CREATE TABLE staff_role_assignment (
  assignment_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_key TEXT NOT NULL CHECK (
    role_key IN (
      'super_admin',
      'air_import_rep',
      'air_export_rep',
      'sea_import_rep',
      'sea_export_rep'
    )
  ),
  assigned_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE UNIQUE INDEX staff_role_assignment_one_active_user_role
  ON staff_role_assignment (user_id, role_key)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX staff_role_assignment_one_active_super_admin
  ON staff_role_assignment (role_key)
  WHERE role_key = 'super_admin' AND revoked_at IS NULL;
