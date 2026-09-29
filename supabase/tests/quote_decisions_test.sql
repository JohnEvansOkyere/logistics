BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(10);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.quote_decision', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.quote_decision', 'SELECT')
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.quote_decision'::regclass),
  'quote decisions are private: no grants and row level security is on'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'decisions-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000000b5', 'Synthetic Decisions Ltd');
INSERT INTO app.quote (quote_id, service_line, customer_company_id, created_by)
VALUES ('00000000-0000-4000-8000-0000000000c5', 'sea_import',
        '00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000a5'),
       ('00000000-0000-4000-8000-0000000000c6', 'sea_import',
        '00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000a5');
INSERT INTO app.quote_version (version_id, quote_id, version_number, currency, title, created_by)
VALUES ('00000000-0000-4000-8000-0000000000d5', '00000000-0000-4000-8000-0000000000c5',
        1, 'USD', 'Synthetic quotation', '00000000-0000-4000-8000-0000000000a5'),
       ('00000000-0000-4000-8000-0000000000d6', '00000000-0000-4000-8000-0000000000c6',
        1, 'USD', 'Second synthetic quotation', '00000000-0000-4000-8000-0000000000a5');
INSERT INTO app.quote_line (version_id, position, description, basis, amount_minor)
VALUES ('00000000-0000-4000-8000-0000000000d5', 0, 'Fee', 'fixed', 100),
       ('00000000-0000-4000-8000-0000000000d6', 0, 'Fee', 'fixed', 100);

SELECT extensions.throws_ok(
  $$INSERT INTO app.quote_decision (quote_id, version_id, decision, client_signatory, decided_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000d5',
            'accepted', 'A. Client', now(), '00000000-0000-4000-8000-0000000000a5')$$,
  'only an issued quote version can be accepted or rejected',
  'a draft version cannot be decided'
);

UPDATE app.quote_version SET status = 'issued', issued_at = now(),
  issued_by = '00000000-0000-4000-8000-0000000000a5'
WHERE quote_id IN ('00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000c6');

SELECT extensions.lives_ok(
  $$INSERT INTO app.quote_decision (decision_id, quote_id, version_id, decision, client_signatory, decided_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000c5',
            '00000000-0000-4000-8000-0000000000d5', 'accepted', 'A. Client', now(),
            '00000000-0000-4000-8000-0000000000a5')$$,
  'an issued version can be accepted'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.quote_decision (quote_id, version_id, decision, client_signatory, decided_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000d5',
            'rejected', 'A. Client', now(), '00000000-0000-4000-8000-0000000000a5')$$,
  '23505',
  NULL,
  'a version is decided once'
);
SELECT extensions.throws_ok(
  $$UPDATE app.quote_decision SET decision = 'rejected'$$,
  'quote decisions are append-only',
  'a decision cannot be changed'
);
SELECT extensions.throws_ok(
  $$DELETE FROM app.quote_decision$$,
  'quote decisions are append-only',
  'a decision cannot be deleted'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.quote_version (quote_id, version_number, currency, title, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c5', 2, 'USD', 'Late revision',
            '00000000-0000-4000-8000-0000000000a5')$$,
  'an accepted quote cannot be revised',
  'an accepted quote gets no new version'
);

SELECT extensions.lives_ok(
  $$INSERT INTO app.job (file_number, service_line, customer_company_id, quote_id, opened_by)
    VALUES ('BJH/SI/2099/9001', 'sea_import', '00000000-0000-4000-8000-0000000000b5',
            '00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000a5')$$,
  'an accepted quote opens a job'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.job (file_number, service_line, customer_company_id, quote_id, opened_by)
    VALUES ('BJH/SI/2099/9002', 'sea_import', '00000000-0000-4000-8000-0000000000b5',
            '00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000a5')$$,
  '23505',
  NULL,
  'a quote opens at most one job'
);

SELECT extensions.lives_ok(
  $$INSERT INTO app.quote_decision (quote_id, version_id, decision, client_signatory, decided_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-0000000000d6',
            'rejected', 'A. Client', now(), '00000000-0000-4000-8000-0000000000a5')$$,
  'a rejection does not lock the quote'
);

SELECT * FROM extensions.finish();
ROLLBACK;
