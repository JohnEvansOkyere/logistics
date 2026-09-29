BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(8);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.job_party', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.shipment_reference', 'SELECT'),
  'anon and authenticated have no party or reference grants'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'refs-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000000b5', 'Synthetic Refs Ltd');
INSERT INTO app.job (job_id, file_number, service_line, customer_company_id, opened_by)
VALUES ('00000000-0000-4000-8000-0000000000c5', 'BJH/SI/2099/0005', 'sea_import',
        '00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000a5'),
       ('00000000-0000-4000-8000-0000000000c6', 'BJH/SI/2099/0006', 'sea_import',
        '00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000a5');

INSERT INTO app.shipment_reference (reference_id, job_id, kind, reference_value, created_by)
VALUES ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000c5',
        'master_bl', 'MBL-SYN-001', '00000000-0000-4000-8000-0000000000a5'),
       ('00000000-0000-4000-8000-0000000000e9', '00000000-0000-4000-8000-0000000000c6',
        'master_bl', 'MBL-SYN-OTHER', '00000000-0000-4000-8000-0000000000a5');

SELECT extensions.lives_ok(
  $$INSERT INTO app.shipment_reference (job_id, kind, reference_value, parent_reference_id, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c5', 'house_bl', 'HBL-SYN-001',
            '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a5'),
           ('00000000-0000-4000-8000-0000000000c5', 'house_bl', 'HBL-SYN-002',
            '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a5')$$,
  'one master can have many houses'
);
SELECT extensions.is(
  (SELECT count(*) FROM app.shipment_reference WHERE parent_reference_id = '00000000-0000-4000-8000-0000000000e1'),
  2::bigint,
  'both houses point at the master'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.shipment_reference (job_id, kind, reference_value, parent_reference_id, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c5', 'house_bl', 'HBL-SYN-X',
            '00000000-0000-4000-8000-0000000000e9', '00000000-0000-4000-8000-0000000000a5')$$,
  'house reference must belong to an active master of the same job',
  'a house cannot hang under another job''s master'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.shipment_reference (job_id, kind, reference_value, parent_reference_id, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c5', 'house_awb', 'HAWB-SYN-X',
            '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a5')$$,
  'house reference must belong to an active master of the same job',
  'a house AWB cannot hang under a master B/L'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.shipment_reference (job_id, kind, reference_value, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c5', 'master_bl', 'mbl-syn-001',
            '00000000-0000-4000-8000-0000000000a5')$$,
  '23505',
  NULL,
  'the same reference cannot be active twice on a job (case-insensitive)'
);
SELECT extensions.lives_ok(
  $$INSERT INTO app.shipment_reference (job_id, kind, reference_value, seal_number, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c5', 'container', 'SYNU1234567', 'SEAL-1',
            '00000000-0000-4000-8000-0000000000a5')$$,
  'a container can carry a seal number'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.shipment_reference (job_id, kind, reference_value, seal_number, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c5', 'booking', 'BKG-1', 'SEAL-2',
            '00000000-0000-4000-8000-0000000000a5')$$,
  '23514',
  NULL,
  'only containers carry seals'
);

SELECT * FROM extensions.finish();
ROLLBACK;
