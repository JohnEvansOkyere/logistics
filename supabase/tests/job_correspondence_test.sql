BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(6);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.job_correspondence', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.job_correspondence', 'INSERT')
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.job_correspondence'::regclass),
  'correspondence is private: no grants and row level security is on'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000003aa', 'authenticated', 'authenticated', 'corr-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000003ba', 'Synthetic Correspondence Ltd');
INSERT INTO app.job (job_id, file_number, service_line, customer_company_id, opened_by)
VALUES ('00000000-0000-4000-8000-0000000003ca', 'BJH/SI/2099/9401', 'sea_import',
        '00000000-0000-4000-8000-0000000003ba', '00000000-0000-4000-8000-0000000003aa'),
       ('00000000-0000-4000-8000-0000000003cb', 'BJH/SI/2099/9402', 'sea_import',
        '00000000-0000-4000-8000-0000000003ba', '00000000-0000-4000-8000-0000000003aa');
INSERT INTO app.document (document_id, job_id, document_type, created_by)
VALUES ('00000000-0000-4000-8000-0000000003da', '00000000-0000-4000-8000-0000000003ca', 'other',
        '00000000-0000-4000-8000-0000000003aa'),
       ('00000000-0000-4000-8000-0000000003db', '00000000-0000-4000-8000-0000000003cb', 'other',
        '00000000-0000-4000-8000-0000000003aa');

SELECT extensions.lives_ok(
  $$INSERT INTO app.job_correspondence (entry_id, job_id, channel, direction, occurred_at, body,
      document_id, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000003e0', '00000000-0000-4000-8000-0000000003ca',
            'email', 'received', now(), 'Please confirm the arrival date.',
            '00000000-0000-4000-8000-0000000003da', '00000000-0000-4000-8000-0000000003aa')$$,
  'an entry can carry an attachment from the same job'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.job_correspondence (job_id, channel, direction, occurred_at, body, document_id, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000003ca', 'email', 'sent', now(), 'x',
            '00000000-0000-4000-8000-0000000003db', '00000000-0000-4000-8000-0000000003aa')$$,
  'P0001', 'an attachment must be a document on the same job',
  'an attachment from another job is refused'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.job_correspondence (job_id, channel, direction, occurred_at, body, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000003ca', 'telegram', 'sent', now(), 'x',
            '00000000-0000-4000-8000-0000000003aa')$$,
  '23514', NULL, 'only known channels are accepted'
);
SELECT extensions.throws_ok(
  $$UPDATE app.job_correspondence SET body = 'edited'
    WHERE entry_id = '00000000-0000-4000-8000-0000000003e0'$$,
  'P0001', 'correspondence entries are append-only', 'an entry cannot be edited'
);
SELECT extensions.throws_ok(
  $$DELETE FROM app.job_correspondence WHERE entry_id = '00000000-0000-4000-8000-0000000003e0'$$,
  'P0001', 'correspondence entries are append-only', 'an entry cannot be deleted'
);

SELECT * FROM extensions.finish();
ROLLBACK;
