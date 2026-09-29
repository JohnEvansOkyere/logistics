BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(14);

SELECT extensions.has_table('app', 'job', 'job table exists');
SELECT extensions.has_table('app', 'job_number_sequence', 'number sequence table exists');
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.job'::regclass),
  'row level security is enabled on job'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.job', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.job', 'SELECT'),
  'anon and authenticated have no job grants'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'app.job_number_sequence', 'UPDATE'),
  'authenticated cannot write the number sequence'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'app.allocate_job_number(text, integer)', 'EXECUTE'),
  'authenticated cannot allocate job numbers'
);

SELECT extensions.is(app.allocate_job_number('sea_import', 2099), 'BJH/SI/2099/0001', 'first sea import number of the year');
SELECT extensions.is(app.allocate_job_number('sea_import', 2099), 'BJH/SI/2099/0002', 'sequence increments');
SELECT extensions.is(app.allocate_job_number('air_export', 2099), 'BJH/AE/2099/0001', 'each service line has its own sequence');
SELECT extensions.is(app.allocate_job_number('sea_import', 2100), 'BJH/SI/2100/0001', 'sequence restarts each year');
SELECT extensions.throws_ok(
  $$SELECT app.allocate_job_number('road', 2099)$$,
  'unsupported service line: road',
  'unknown service lines are rejected'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'jobs-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000000b1', 'Synthetic Jobs Ltd');
INSERT INTO app.job (job_id, file_number, service_line, customer_company_id, opened_by)
VALUES ('00000000-0000-4000-8000-0000000000c1', 'BJH/SI/2099/0001', 'sea_import',
        '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1');

SELECT extensions.throws_ok(
  $$INSERT INTO app.job (file_number, service_line, customer_company_id, opened_by)
    VALUES ('BJH/SI/2099/0001', 'sea_import',
            '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1')$$,
  '23505',
  NULL,
  'file numbers are unique'
);
SELECT extensions.throws_ok(
  $$UPDATE app.job SET file_number = 'BJH/SI/2099/9999'$$,
  'job identity fields are immutable',
  'file number cannot be changed'
);
SELECT extensions.lives_ok(
  $$UPDATE app.job SET status = 'closed', closed_at = now()$$,
  'a job can be closed'
);

SELECT * FROM extensions.finish();
ROLLBACK;
