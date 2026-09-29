BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(18);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.quote', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.quote_version', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.quote_line', 'SELECT')
  AND NOT has_function_privilege('authenticated', 'app.allocate_quote_number(text, integer, text)', 'EXECUTE'),
  'anon and authenticated have no quote grants'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.quote'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.quote_version'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.quote_line'::regclass),
  'row level security is enabled on quotes, versions and lines'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'quotes-test@example.test', '');
INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000000b4', 'Synthetic Quotes Ltd');
INSERT INTO app.quote (quote_id, service_line, customer_company_id, created_by)
VALUES ('00000000-0000-4000-8000-0000000000c4', 'sea_import',
        '00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000a4');
INSERT INTO app.quote_version (version_id, quote_id, version_number, currency, title, created_by)
VALUES ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000c4',
        1, 'USD', 'Synthetic quotation', '00000000-0000-4000-8000-0000000000a4');

SELECT extensions.throws_ok(
  $$INSERT INTO app.quote_version (quote_id, version_number, currency, title, created_by)
    VALUES ('00000000-0000-4000-8000-0000000000c4', 2, 'USD', 'Second draft',
            '00000000-0000-4000-8000-0000000000a4')$$,
  '23505',
  NULL,
  'a quote has at most one draft version'
);
SELECT extensions.throws_ok(
  $$UPDATE app.quote_version SET status = 'issued', issued_at = now(),
      issued_by = '00000000-0000-4000-8000-0000000000a4'
    WHERE version_id = '00000000-0000-4000-8000-0000000000d4'$$,
  'a quote version needs at least one charge line to be issued',
  'a version without charge lines cannot be issued'
);

SELECT extensions.lives_ok(
  $$INSERT INTO app.quote_line (line_id, version_id, position, description, basis, amount_20ft_minor, amount_40ft_minor)
    VALUES ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000d4',
            0, 'Port handling fee', 'at_cost', 25000, 50000)$$,
  'a line can carry 20ft and 40ft amounts'
);
SELECT extensions.lives_ok(
  $$INSERT INTO app.quote_line (version_id, position, description, basis, basis_note)
    VALUES ('00000000-0000-4000-8000-0000000000d4', 1, 'Customs duty', 'at_cost', 'Based on HS code')$$,
  'an at-cost line may leave the amount out'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.quote_line (version_id, position, description, basis)
    VALUES ('00000000-0000-4000-8000-0000000000d4', 2, 'Documentation', 'per_bl')$$,
  '23514',
  NULL,
  'a fixed-price line needs an amount'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.quote_line (version_id, position, description, basis, amount_minor, amount_20ft_minor, amount_40ft_minor)
    VALUES ('00000000-0000-4000-8000-0000000000d4', 2, 'Both forms', 'fixed', 100, 100, 100)$$,
  '23514',
  NULL,
  'a line cannot mix one amount with size amounts'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.quote_line (version_id, position, description, basis, amount_20ft_minor)
    VALUES ('00000000-0000-4000-8000-0000000000d4', 2, 'Half sized', 'fixed', 100)$$,
  '23514',
  NULL,
  'size amounts come as a 20ft and 40ft pair'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.quote_line (version_id, position, description, basis, amount_minor)
    VALUES ('00000000-0000-4000-8000-0000000000d4', 2, 'Negative', 'fixed', -1)$$,
  '23514',
  NULL,
  'amounts cannot be negative'
);

SELECT extensions.is(
  app.allocate_quote_number('sea_import', 2099),
  'BJH/Q/SI/2099/0001',
  'the first quote number of the year'
);
SELECT extensions.is(
  app.allocate_quote_number('sea_import', 2099),
  'BJH/Q/SI/2099/0002',
  'the next number follows'
);

SELECT extensions.lives_ok(
  $$UPDATE app.quote_version SET status = 'issued', issued_at = now(),
      issued_by = '00000000-0000-4000-8000-0000000000a4'
    WHERE version_id = '00000000-0000-4000-8000-0000000000d4'$$,
  'a version with lines can be issued'
);
SELECT extensions.throws_ok(
  $$UPDATE app.quote_version SET title = 'Edited after issue'
    WHERE version_id = '00000000-0000-4000-8000-0000000000d4'$$,
  'issued quote versions are immutable',
  'an issued version cannot be edited'
);
SELECT extensions.throws_ok(
  $$DELETE FROM app.quote_version WHERE version_id = '00000000-0000-4000-8000-0000000000d4'$$,
  'issued quote versions are immutable',
  'an issued version cannot be deleted'
);
SELECT extensions.throws_ok(
  $$UPDATE app.quote_line SET amount_20ft_minor = 1, amount_40ft_minor = 1
    WHERE line_id = '00000000-0000-4000-8000-0000000000e4'$$,
  'lines of an issued quote version are immutable',
  'lines of an issued version cannot be changed'
);
SELECT extensions.throws_ok(
  $$INSERT INTO app.quote_line (version_id, position, description, basis, amount_minor)
    VALUES ('00000000-0000-4000-8000-0000000000d4', 5, 'Late addition', 'fixed', 100)$$,
  'lines of an issued quote version are immutable',
  'lines cannot be added to an issued version'
);
SELECT extensions.throws_ok(
  $$UPDATE app.quote SET customer_company_id = '00000000-0000-4000-8000-0000000000b4', service_line = 'air_import'
    WHERE quote_id = '00000000-0000-4000-8000-0000000000c4'$$,
  'quote identity fields are immutable',
  'a quote cannot change its service line or customer'
);

SELECT * FROM extensions.finish();
ROLLBACK;
