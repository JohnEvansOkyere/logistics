BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(10);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.eta_event', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.eta_event', 'SELECT')
  AND NOT has_table_privilege('anon', 'app.job_task', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.job_task', 'SELECT'),
  'anon and authenticated have no ETA or task grants'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.eta_event'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.job_task'::regclass),
  'row level security is enabled on ETA events and tasks'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'eta-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000000b3', 'Synthetic ETA Ltd');
INSERT INTO app.job (job_id, file_number, service_line, customer_company_id, opened_by)
VALUES ('00000000-0000-4000-8000-0000000000c3', 'BJH/SI/2099/0003', 'sea_import',
        '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a3');

SELECT extensions.lives_ok(
  $$INSERT INTO app.eta_event (eta_id, job_id, eta_at, source, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000c3',
            now() + interval '5 days', 'carrier notice', '00000000-0000-4000-8000-0000000000a3')$$,
  'an ETA can be recorded'
);
SELECT extensions.lives_ok(
  $$INSERT INTO app.eta_event (job_id, eta_at, source, recorded_by, correction_of)
    VALUES ('00000000-0000-4000-8000-0000000000c3', now() + interval '8 days', 'delay notice',
            '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000d3')$$,
  'an ETA correction is a new row pointing at the original'
);
SELECT extensions.throws_ok(
  $$UPDATE app.eta_event SET source = 'edited'$$,
  'eta events are append-only',
  'ETA history cannot be edited'
);
SELECT extensions.throws_ok(
  $$DELETE FROM app.eta_event$$,
  'eta events are append-only',
  'ETA history cannot be deleted'
);
SELECT extensions.lives_ok(
  $$INSERT INTO app.job_task (job_id, kind, title, assigned_role, due_date, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c3', 'delay', 'Call the carrier',
            'sea_import_rep', current_date, '00000000-0000-4000-8000-0000000000a3')$$,
  'a task can be assigned to a role'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.job_task (job_id, kind, title, assigned_role, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c3', 'task', 'x', 'driver',
            '00000000-0000-4000-8000-0000000000a3')$$,
  '23514',
  NULL,
  'tasks can only be assigned to a staff role'
);
SELECT extensions.throws_ok(
  $$UPDATE app.job_task SET status = 'done'$$,
  '23514',
  NULL,
  'a task cannot be marked done without who and when'
);
SELECT extensions.lives_ok(
  $$UPDATE app.job_task SET status = 'done', completed_at = now(),
      completed_by = '00000000-0000-4000-8000-0000000000a3'$$,
  'a task can be completed with who and when'
);

SELECT * FROM extensions.finish();
ROLLBACK;
