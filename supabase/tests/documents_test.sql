BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(7);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.document', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.document_version', 'SELECT'),
  'anon and authenticated have no document grants'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000000a7', 'authenticated', 'authenticated', 'docs-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000000b7', 'Synthetic Docs Ltd');
INSERT INTO app.job (job_id, file_number, service_line, customer_company_id, opened_by)
VALUES ('00000000-0000-4000-8000-0000000000c7', 'BJH/SI/2099/0007', 'sea_import',
        '00000000-0000-4000-8000-0000000000b7', '00000000-0000-4000-8000-0000000000a7');
INSERT INTO app.document (document_id, job_id, document_type, created_by)
VALUES ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000c7',
        'supplier_invoice', '00000000-0000-4000-8000-0000000000a7');

SELECT extensions.lives_ok(
  $$INSERT INTO app.document_version
      (document_id, version_number, original_filename, content_type, size_bytes, sha256, object_key, uploaded_by)
    VALUES ('00000000-0000-4000-8000-0000000000f1', 1, 'invoice.pdf', 'application/pdf', 1234,
            repeat('a', 64), 'synthetic-key-1', '00000000-0000-4000-8000-0000000000a7')$$,
  'a document version can be recorded'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.document_version
      (document_id, version_number, original_filename, content_type, size_bytes, sha256, object_key, uploaded_by)
    VALUES ('00000000-0000-4000-8000-0000000000f1', 1, 'again.pdf', 'application/pdf', 1,
            repeat('b', 64), 'synthetic-key-2', '00000000-0000-4000-8000-0000000000a7')$$,
  '23505',
  NULL,
  'a version number cannot be reused'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.document_version
      (document_id, version_number, original_filename, content_type, size_bytes, sha256, object_key, uploaded_by)
    VALUES ('00000000-0000-4000-8000-0000000000f1', 2, 'x.exe', 'application/x-msdownload', 1,
            repeat('c', 64), 'synthetic-key-3', '00000000-0000-4000-8000-0000000000a7')$$,
  '23514',
  NULL,
  'only agreed content types are accepted'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.document (job_id, document_type, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c7', 'bjh_invoice',
            '00000000-0000-4000-8000-0000000000a7')$$,
  '23514',
  NULL,
  'unknown document types are rejected'
);
SELECT extensions.throws_ok(
  $$UPDATE app.document_version SET original_filename = 'renamed.pdf'$$,
  'document versions are immutable',
  'versions cannot be edited'
);
SELECT extensions.throws_ok(
  $$DELETE FROM app.document_version$$,
  'document versions are immutable',
  'versions cannot be deleted'
);

SELECT * FROM extensions.finish();
ROLLBACK;
