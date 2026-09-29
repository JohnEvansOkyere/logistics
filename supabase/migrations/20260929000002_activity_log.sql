-- Append-only log of what authenticated users do through the API. Request
-- bodies and query strings are never stored (they may contain passwords).

CREATE TABLE app.activity_log (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id),
  actor_email text,
  method text NOT NULL,
  route text NOT NULL,
  entity_id uuid,
  status_code integer NOT NULL,
  client_ip text
);

CREATE INDEX activity_log_time ON app.activity_log (occurred_at DESC, activity_id DESC);
CREATE INDEX activity_log_actor ON app.activity_log (actor_user_id, occurred_at DESC);
CREATE INDEX activity_log_entity ON app.activity_log (entity_id, occurred_at DESC)
  WHERE entity_id IS NOT NULL;

CREATE FUNCTION app.prevent_activity_log_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'activity log entries are append-only';
END;
$$;

REVOKE ALL ON FUNCTION app.prevent_activity_log_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER activity_log_append_only
  BEFORE UPDATE OR DELETE ON app.activity_log
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_activity_log_change();

ALTER TABLE app.activity_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.activity_log FROM PUBLIC, anon, authenticated;
