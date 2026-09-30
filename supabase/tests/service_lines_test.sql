BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(6);

SELECT extensions.is(app.allocate_job_number('warehousing', 2098), 'BJH/WH/2098/0001',
  'warehousing jobs are numbered BJH/WH');
SELECT extensions.is(app.allocate_job_number('road_transport', 2098), 'BJH/RT/2098/0001',
  'road transport jobs are numbered BJH/RT');
SELECT extensions.is(app.allocate_quote_number('warehousing', 2098), 'BJH/Q/WH/2098/0001',
  'warehousing quotes are numbered BJH/Q/WH');
SELECT extensions.is(app.allocate_quote_number('road_transport', 2098, 'SYN/Q'), 'SYN/Q/RT/2098/0001',
  'road transport quotes take the configured prefix');
SELECT extensions.is(app.allocate_job_number('sea_import', 2098), 'BJH/SI/2098/0001',
  'the original lines are numbered as before');
SELECT extensions.throws_ok(
  $$SELECT app.allocate_job_number('space_freight', 2098)$$,
  'P0001', 'unsupported service line: space_freight', 'unknown lines are still refused'
);

SELECT * FROM extensions.finish();
ROLLBACK;
