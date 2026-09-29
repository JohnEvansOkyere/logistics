BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(8);

SELECT extensions.has_table('app', 'milestone_event', 'milestone event table exists');
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.milestone_event'::regclass),
  'row level security is enabled on milestone events'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.milestone_event', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.milestone_event', 'SELECT'),
  'anon and authenticated have no milestone grants'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'milestones-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000000b2', 'Synthetic Milestones Ltd');
INSERT INTO app.job (job_id, file_number, service_line, customer_company_id, opened_by)
VALUES ('00000000-0000-4000-8000-0000000000c2', 'BJH/SI/2099/0002', 'sea_import',
        '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2');

SELECT extensions.lives_ok(
  $$INSERT INTO app.milestone_event (event_id, job_id, milestone_key, occurred_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c2',
            'cargo_arrived', now(), '00000000-0000-4000-8000-0000000000a2')$$,
  'a milestone event can be recorded'
);
SELECT extensions.lives_ok(
  $$INSERT INTO app.milestone_event (job_id, milestone_key, occurred_at, recorded_by, note, correction_of)
    VALUES ('00000000-0000-4000-8000-0000000000c2', 'cargo_arrived', now(),
            '00000000-0000-4000-8000-0000000000a2', 'wrong day, corrected',
            '00000000-0000-4000-8000-0000000000d1')$$,
  'a correction is a new event pointing at the original'
);
SELECT extensions.throws_ok(
  $$UPDATE app.milestone_event SET note = 'edited'$$,
  'milestone events are append-only',
  'events cannot be edited'
);
SELECT extensions.throws_ok(
  $$DELETE FROM app.milestone_event$$,
  'milestone events are append-only',
  'events cannot be deleted'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.milestone_event (job_id, milestone_key, occurred_at, recorded_by, source)
    VALUES ('00000000-0000-4000-8000-0000000000c2', 'x', now(),
            '00000000-0000-4000-8000-0000000000a2', 'carrier-scrape')$$,
  '23514',
  NULL,
  'only known sources are accepted'
);

SELECT * FROM extensions.finish();
ROLLBACK;
