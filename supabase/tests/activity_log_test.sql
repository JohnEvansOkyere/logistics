BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(6);

SELECT extensions.has_table('app', 'activity_log', 'activity log table exists');
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.activity_log'::regclass),
  'row level security is enabled on the activity log'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.activity_log', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.activity_log', 'SELECT'),
  'anon and authenticated cannot read the activity log'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'activity-test@example.test', '');

SELECT extensions.lives_ok(
  $$INSERT INTO app.activity_log (actor_user_id, actor_email, method, route, status_code)
    VALUES ('00000000-0000-4000-8000-0000000000a3', 'activity-test@example.test',
            'POST', '/api/v1/jobs', 201)$$,
  'an activity entry can be recorded'
);
SELECT extensions.throws_ok(
  $$UPDATE app.activity_log SET status_code = 200$$,
  'activity log entries are append-only',
  'entries cannot be edited'
);
SELECT extensions.throws_ok(
  $$DELETE FROM app.activity_log$$,
  'activity log entries are append-only',
  'entries cannot be deleted'
);

SELECT * FROM extensions.finish();
ROLLBACK;
