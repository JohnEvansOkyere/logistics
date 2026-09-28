ALTER TABLE staff_role_assignment
  ADD COLUMN assigned_by TEXT;

UPDATE staff_role_assignment
SET assigned_by = user_id
WHERE assigned_by IS NULL;

CREATE TABLE staff_role_audit_event (
  event_id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('staff_role_assigned', 'staff_role_revoked')),
  assignment_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
