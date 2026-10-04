BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(5);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000004aa', 'authenticated', 'authenticated', 'library-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000004ba', 'Synthetic Library Ltd');
INSERT INTO app.job (job_id, file_number, service_line, customer_company_id, opened_by)
VALUES ('00000000-0000-4000-8000-0000000004ca', 'BJH/SI/2099/9501', 'sea_import',
        '00000000-0000-4000-8000-0000000004ba', '00000000-0000-4000-8000-0000000004aa');

SELECT extensions.lives_ok(
  $$INSERT INTO app.document (document_id, document_type, title, created_by)
    VALUES ('00000000-0000-4000-8000-0000000004da', 'office_letter', 'Standalone letter',
            '00000000-0000-4000-8000-0000000004aa')$$,
  'a document can stand alone, with no job and no company'
);
SELECT extensions.lives_ok(
  $$INSERT INTO app.document (document_id, company_id, document_type, created_by)
    VALUES ('00000000-0000-4000-8000-0000000004db', '00000000-0000-4000-8000-0000000004ba', 'other',
            '00000000-0000-4000-8000-0000000004aa')$$,
  'a standalone document can belong to one company'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.document (job_id, company_id, document_type, created_by)
    VALUES ('00000000-0000-4000-8000-0000000004ca', '00000000-0000-4000-8000-0000000004ba', 'other',
            '00000000-0000-4000-8000-0000000004aa')$$,
  '23514', NULL, 'a document cannot name both a job and a company'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.document (document_type, title, created_by)
    VALUES ('other', '', '00000000-0000-4000-8000-0000000004aa')$$,
  '23514', NULL, 'an empty title is refused'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.document', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.document', 'SELECT'),
  'documents stay private: no direct grants'
);

SELECT * FROM extensions.finish();
ROLLBACK;
