CREATE UNIQUE INDEX staff_role_assignment_one_active_super_admin
  ON app.staff_role_assignment (role_key)
  WHERE role_key = 'super_admin' AND revoked_at IS NULL;
