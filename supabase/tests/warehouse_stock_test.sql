BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(9);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.stock_movement', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.warehouse_location', 'SELECT')
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.stock_movement'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.warehouse_location'::regclass),
  'warehouse records are private: no grants and row level security is on'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000004aa', 'authenticated', 'authenticated', 'stock-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000004ba', 'Synthetic Stock Ltd');
INSERT INTO app.job (job_id, file_number, service_line, customer_company_id, opened_by)
VALUES ('00000000-0000-4000-8000-0000000004ca', 'BJH/WH/2099/9501', 'warehousing',
        '00000000-0000-4000-8000-0000000004ba', '00000000-0000-4000-8000-0000000004aa'),
       ('00000000-0000-4000-8000-0000000004cb', 'BJH/SI/2099/9502', 'sea_import',
        '00000000-0000-4000-8000-0000000004ba', '00000000-0000-4000-8000-0000000004aa');
INSERT INTO app.warehouse_location (location_id, location_name, created_by)
VALUES ('00000000-0000-4000-8000-0000000004da', 'Bay A1', '00000000-0000-4000-8000-0000000004aa'),
       ('00000000-0000-4000-8000-0000000004db', 'Retired bay', '00000000-0000-4000-8000-0000000004aa');
UPDATE app.warehouse_location SET deactivated_at = now()
WHERE location_id = '00000000-0000-4000-8000-0000000004db';

SELECT extensions.throws_ok(
  $$INSERT INTO app.warehouse_location (location_name, created_by)
    VALUES ('bay a1', '00000000-0000-4000-8000-0000000004aa')$$,
  '23505', NULL, 'a location name is unique regardless of case'
);

-- 10 received on Jan 1.
INSERT INTO app.stock_movement (job_id, location_id, kind, item, unit, quantity, occurred_at, recorded_by)
VALUES ('00000000-0000-4000-8000-0000000004ca', '00000000-0000-4000-8000-0000000004da',
        'receipt', 'Cartons of tiles', 'cartons', 10, '2099-01-01', '00000000-0000-4000-8000-0000000004aa');

SELECT extensions.throws_ok(
  $$INSERT INTO app.stock_movement (job_id, location_id, kind, item, unit, quantity, occurred_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000004cb', '00000000-0000-4000-8000-0000000004da',
            'receipt', 'x', 'units', 1, '2099-01-01', '00000000-0000-4000-8000-0000000004aa')$$,
  'P0001', 'stock is recorded on a warehousing job', 'only a warehousing job takes stock'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.stock_movement (job_id, location_id, kind, item, unit, quantity, occurred_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000004ca', '00000000-0000-4000-8000-0000000004db',
            'receipt', 'x', 'units', 1, '2099-01-01', '00000000-0000-4000-8000-0000000004aa')$$,
  'P0001', 'the warehouse location is not in use', 'a retired location takes no stock'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.stock_movement (job_id, location_id, kind, item, unit, quantity, occurred_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000004ca', '00000000-0000-4000-8000-0000000004da',
            'release', 'cartons of tiles', 'CARTONS', 11, '2099-01-05', '00000000-0000-4000-8000-0000000004aa')$$,
  'P0001', 'insufficient stock: the balance cannot go below zero',
  'releasing more than is held is refused (item and unit match regardless of case)'
);

INSERT INTO app.stock_movement (job_id, location_id, kind, item, unit, quantity, occurred_at, recorded_by)
VALUES ('00000000-0000-4000-8000-0000000004ca', '00000000-0000-4000-8000-0000000004da',
        'release', 'Cartons of tiles', 'cartons', 9, '2099-01-10', '00000000-0000-4000-8000-0000000004aa'),
       ('00000000-0000-4000-8000-0000000004ca', '00000000-0000-4000-8000-0000000004da',
        'receipt', 'Cartons of tiles', 'cartons', 10, '2099-01-20', '00000000-0000-4000-8000-0000000004aa');

SELECT extensions.throws_ok(
  $$INSERT INTO app.stock_movement (job_id, location_id, kind, item, unit, quantity, occurred_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000004ca', '00000000-0000-4000-8000-0000000004da',
            'release', 'Cartons of tiles', 'cartons', 5, '2099-01-02', '00000000-0000-4000-8000-0000000004aa')$$,
  'P0001', 'insufficient stock: the balance cannot go below zero',
  'a backdated release that would leave an earlier date negative is refused'
);
SELECT extensions.lives_ok(
  $$INSERT INTO app.stock_movement (job_id, location_id, kind, item, unit, quantity, occurred_at, recorded_by)
    VALUES ('00000000-0000-4000-8000-0000000004ca', '00000000-0000-4000-8000-0000000004da',
            'release', 'Cartons of tiles', 'cartons', 1, '2099-01-02', '00000000-0000-4000-8000-0000000004aa')$$,
  'a backdated release that keeps every date at or above zero is accepted'
);
SELECT extensions.throws_ok(
  $$UPDATE app.stock_movement SET quantity = 1$$,
  'P0001', 'stock movements are append-only', 'movements cannot be edited'
);
SELECT extensions.throws_ok(
  $$DELETE FROM app.stock_movement$$,
  'P0001', 'stock movements are append-only', 'movements cannot be deleted'
);

SELECT * FROM extensions.finish();
ROLLBACK;
