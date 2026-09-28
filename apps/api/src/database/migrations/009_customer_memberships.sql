CREATE TABLE customer_membership (
  membership_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES customer_company (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_at TEXT CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE UNIQUE INDEX customer_membership_one_active_company_link
  ON customer_membership (company_id, user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE customer_membership_audit_event (
  event_id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('customer_membership_granted', 'customer_membership_revoked')
  ),
  membership_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
