BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(61);

SELECT extensions.has_schema('app', 'private application schema exists');
SELECT extensions.ok(
  NOT has_schema_privilege('anon', 'app', 'USAGE'),
  'anonymous role cannot use the private schema'
);
SELECT extensions.ok(
  NOT has_schema_privilege('authenticated', 'app', 'USAGE'),
  'authenticated role has no private-schema access by default'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.staff_role_assignment', 'SELECT'),
  'anonymous role has no staff-role table grant'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.customer_record', 'SELECT'),
  'anonymous role has no customer-record table grant'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'app.customer_record', 'UPDATE'),
  'authenticated clients cannot write customer records directly'
);

-- All app-schema access below is transaction-local test access. Nothing here
-- creates an application account or durable fixture record.
GRANT USAGE ON SCHEMA app TO authenticated;

INSERT INTO auth.users (id, aud, role, email)
VALUES
  ('00000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'kofi@example.test'),
  ('00000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'kojo@example.test'),
  ('00000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'yaw@example.test'),
  ('00000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'ama@example.test'),
  ('00000000-0000-4000-8000-000000000015', 'authenticated', 'authenticated', 'esi@example.test'),
  ('00000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'abena@example.test'),
  ('00000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'nana@example.test');

INSERT INTO app.staff_role_assignment (user_id, role_key, assigned_by)
VALUES
  ('00000000-0000-4000-8000-000000000011', 'super_admin', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000012', 'air_import_rep', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000013', 'air_export_rep', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000014', 'sea_import_rep', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000015', 'sea_export_rep', '00000000-0000-4000-8000-000000000011');

INSERT INTO app.customer_company (company_id, company_name)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Harbor Demo Ltd'),
  ('10000000-0000-4000-8000-000000000002', 'Cedar Demo Ltd');

INSERT INTO app.customer_membership (company_id, user_id, granted_by)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000021',
    '00000000-0000-4000-8000-000000000011'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000022',
    '00000000-0000-4000-8000-000000000011'
  );

INSERT INTO app.customer_record (record_id, company_id, record_type, reference)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'invoice', 'HARBOR-INV-1'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'waybill', 'HARBOR-WAY-1'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'receipt', 'HARBOR-REC-1'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'other', 'HARBOR-OTHER-1'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'other', 'HARBOR-OTHER-2'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'invoice', 'CEDAR-INV-1'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', 'waybill', 'CEDAR-WAY-1'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002', 'receipt', 'CEDAR-REC-1'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002', 'other', 'CEDAR-OTHER-1'),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', 'other', 'CEDAR-OTHER-2');

CREATE TABLE app.workflow_access_probe (
  record_id uuid PRIMARY KEY,
  transport_mode text NOT NULL CHECK (transport_mode IN ('air', 'sea')),
  direction text NOT NULL CHECK (direction IN ('import', 'export')),
  record_label text NOT NULL
);

ALTER TABLE app.workflow_access_probe ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.workflow_access_probe TO authenticated;

CREATE POLICY workflow_probe_read_by_role_scope
  ON app.workflow_access_probe
  FOR SELECT
  TO authenticated
  USING (app.current_user_can_read_workflow(transport_mode, direction));

CREATE POLICY workflow_probe_manage_by_role_scope
  ON app.workflow_access_probe
  FOR ALL
  TO authenticated
  USING (app.current_user_can_manage_workflow(transport_mode, direction))
  WITH CHECK (app.current_user_can_manage_workflow(transport_mode, direction));

INSERT INTO app.workflow_access_probe (record_id, transport_mode, direction, record_label)
VALUES
  ('30000000-0000-4000-8000-000000000001', 'air', 'import', 'Synthetic air import'),
  ('30000000-0000-4000-8000-000000000002', 'air', 'export', 'Synthetic air export'),
  ('30000000-0000-4000-8000-000000000003', 'sea', 'import', 'Synthetic sea import'),
  ('30000000-0000-4000-8000-000000000004', 'sea', 'export', 'Synthetic sea export');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000011';

SELECT extensions.is(
  (SELECT count(*) FROM app.staff_role_assignment),
  5::bigint,
  'Kofi as super_admin can inspect all staff role assignments'
);
SELECT extensions.is(
  (SELECT count(*) FROM app.workflow_access_probe),
  4::bigint,
  'Kofi as super_admin can oversee all four workflow scopes'
);
WITH changed AS (
  UPDATE app.workflow_access_probe
  SET record_label = 'super-admin edit attempt'
  WHERE record_id = '30000000-0000-4000-8000-000000000001'
  RETURNING record_id
)
SELECT extensions.is(
  (SELECT count(*) FROM changed),
  0::bigint,
  'Kofi as oversight-only super_admin cannot edit workflow records'
);
SELECT extensions.is(
  (SELECT count(*) FROM app.audit_event),
  7::bigint,
  'Kofi as super_admin can review role and membership audit events'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000012';

SELECT extensions.is(
  (SELECT count(*) FROM app.workflow_access_probe),
  1::bigint,
  'Kojo as air_import_rep reads only air imports'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM app.workflow_access_probe WHERE transport_mode = 'air' AND direction = 'import'),
  'Kojo can read the assigned air-import scope'
);
SELECT extensions.lives_ok(
  $$INSERT INTO app.workflow_access_probe (record_id, transport_mode, direction, record_label)
    VALUES ('30000000-0000-4000-8000-000000000011', 'air', 'import', 'Kojo air import')$$,
  'Kojo can create an air-import record'
);
WITH changed AS (
  UPDATE app.workflow_access_probe SET record_label = 'Kojo updated air import'
  WHERE record_id = '30000000-0000-4000-8000-000000000011'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM changed), 1::bigint, 'Kojo can update an air-import record');
WITH changed AS (
  UPDATE app.workflow_access_probe SET record_label = 'Kojo cross-scope edit'
  WHERE record_id = '30000000-0000-4000-8000-000000000002'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM changed), 0::bigint, 'Kojo cannot update an air-export record');
WITH removed AS (
  DELETE FROM app.workflow_access_probe
  WHERE record_id = '30000000-0000-4000-8000-000000000011'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM removed), 1::bigint, 'Kojo can delete an air-import record');
SELECT extensions.is((SELECT count(*) FROM app.audit_event), 0::bigint, 'Kojo cannot read audit events');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000013';

SELECT extensions.is((SELECT count(*) FROM app.workflow_access_probe), 1::bigint, 'Yaw as air_export_rep reads only air exports');
SELECT extensions.ok(EXISTS (SELECT 1 FROM app.workflow_access_probe WHERE transport_mode = 'air' AND direction = 'export'), 'Yaw can read the assigned air-export scope');
SELECT extensions.lives_ok(
  $$INSERT INTO app.workflow_access_probe (record_id, transport_mode, direction, record_label)
    VALUES ('30000000-0000-4000-8000-000000000013', 'air', 'export', 'Yaw air export')$$,
  'Yaw can create an air-export record'
);
WITH changed AS (
  UPDATE app.workflow_access_probe SET record_label = 'Yaw updated air export'
  WHERE record_id = '30000000-0000-4000-8000-000000000013'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM changed), 1::bigint, 'Yaw can update an air-export record');
WITH changed AS (
  UPDATE app.workflow_access_probe SET record_label = 'Yaw cross-scope edit'
  WHERE record_id = '30000000-0000-4000-8000-000000000001'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM changed), 0::bigint, 'Yaw cannot update an air-import record');
WITH removed AS (
  DELETE FROM app.workflow_access_probe
  WHERE record_id = '30000000-0000-4000-8000-000000000013'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM removed), 1::bigint, 'Yaw can delete an air-export record');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000014';

SELECT extensions.is((SELECT count(*) FROM app.workflow_access_probe), 1::bigint, 'Ama as sea_import_rep reads only sea imports');
SELECT extensions.ok(EXISTS (SELECT 1 FROM app.workflow_access_probe WHERE transport_mode = 'sea' AND direction = 'import'), 'Ama can read the assigned sea-import scope');
SELECT extensions.lives_ok(
  $$INSERT INTO app.workflow_access_probe (record_id, transport_mode, direction, record_label)
    VALUES ('30000000-0000-4000-8000-000000000014', 'sea', 'import', 'Ama sea import')$$,
  'Ama can create a sea-import record'
);
WITH changed AS (
  UPDATE app.workflow_access_probe SET record_label = 'Ama updated sea import'
  WHERE record_id = '30000000-0000-4000-8000-000000000014'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM changed), 1::bigint, 'Ama can update a sea-import record');
WITH changed AS (
  UPDATE app.workflow_access_probe SET record_label = 'Ama cross-scope edit'
  WHERE record_id = '30000000-0000-4000-8000-000000000004'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM changed), 0::bigint, 'Ama cannot update a sea-export record');
WITH removed AS (
  DELETE FROM app.workflow_access_probe
  WHERE record_id = '30000000-0000-4000-8000-000000000014'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM removed), 1::bigint, 'Ama can delete a sea-import record');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000015';

SELECT extensions.is((SELECT count(*) FROM app.workflow_access_probe), 1::bigint, 'Esi as sea_export_rep reads only sea exports');
SELECT extensions.ok(EXISTS (SELECT 1 FROM app.workflow_access_probe WHERE transport_mode = 'sea' AND direction = 'export'), 'Esi can read the assigned sea-export scope');
SELECT extensions.lives_ok(
  $$INSERT INTO app.workflow_access_probe (record_id, transport_mode, direction, record_label)
    VALUES ('30000000-0000-4000-8000-000000000015', 'sea', 'export', 'Esi sea export')$$,
  'Esi can create a sea-export record'
);
WITH changed AS (
  UPDATE app.workflow_access_probe SET record_label = 'Esi updated sea export'
  WHERE record_id = '30000000-0000-4000-8000-000000000015'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM changed), 1::bigint, 'Esi can update a sea-export record');
WITH changed AS (
  UPDATE app.workflow_access_probe SET record_label = 'Esi cross-scope edit'
  WHERE record_id = '30000000-0000-4000-8000-000000000003'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM changed), 0::bigint, 'Esi cannot update a sea-import record');
WITH removed AS (
  DELETE FROM app.workflow_access_probe
  WHERE record_id = '30000000-0000-4000-8000-000000000015'
  RETURNING record_id
)
SELECT extensions.is((SELECT count(*) FROM removed), 1::bigint, 'Esi can delete a sea-export record');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000021';

SELECT extensions.is((SELECT count(*) FROM app.customer_company), 1::bigint, 'Abena can discover only Harbor Demo Ltd');
SELECT extensions.is((SELECT count(*) FROM app.customer_record), 5::bigint, 'Abena sees all five Harbor Demo Ltd records');
SELECT extensions.is((SELECT count(*) FROM app.customer_record WHERE record_type = 'invoice'), 1::bigint, 'Abena can see its company invoice');
SELECT extensions.is((SELECT count(*) FROM app.customer_record WHERE record_type = 'waybill'), 1::bigint, 'Abena can see its company waybill');
SELECT extensions.is((SELECT count(*) FROM app.customer_record WHERE record_type = 'receipt'), 1::bigint, 'Abena can see its company receipt');
SELECT extensions.is((SELECT count(*) FROM app.customer_record WHERE record_type = 'other'), 2::bigint, 'Abena sees all other Harbor Demo Ltd records');
SELECT extensions.ok(EXISTS (SELECT 1 FROM app.customer_record WHERE record_id = '20000000-0000-4000-8000-000000000005'), 'Abena can see all data owned by Harbor Demo Ltd');
SELECT extensions.is(
  (SELECT count(*) FROM app.customer_record WHERE record_id = '20000000-0000-4000-8000-000000000006'),
  0::bigint,
  'Abena cannot read a known Cedar Demo Ltd record ID'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000022';

SELECT extensions.is((SELECT count(*) FROM app.customer_company), 1::bigint, 'Nana can discover only Cedar Demo Ltd');
SELECT extensions.is((SELECT count(*) FROM app.customer_record), 5::bigint, 'Nana sees all five Cedar Demo Ltd records');
SELECT extensions.is((SELECT count(*) FROM app.customer_record WHERE record_type = 'invoice'), 1::bigint, 'Nana can see its company invoice');
SELECT extensions.is((SELECT count(*) FROM app.customer_record WHERE record_type = 'waybill'), 1::bigint, 'Nana can see its company waybill');
SELECT extensions.is((SELECT count(*) FROM app.customer_record WHERE record_type = 'receipt'), 1::bigint, 'Nana can see its company receipt');
SELECT extensions.is((SELECT count(*) FROM app.customer_record WHERE record_type = 'other'), 2::bigint, 'Nana sees all other Cedar Demo Ltd records');
SELECT extensions.ok(EXISTS (SELECT 1 FROM app.customer_record WHERE record_id = '20000000-0000-4000-8000-000000000010'), 'Nana can see all data owned by Cedar Demo Ltd');
SELECT extensions.is(
  (SELECT count(*) FROM app.customer_record WHERE record_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'Nana cannot read a known Harbor Demo Ltd record ID'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000011';

WITH revoked AS (
  UPDATE app.staff_role_assignment
  SET revoked_at = now()
  WHERE user_id = '00000000-0000-4000-8000-000000000013'
    AND role_key = 'air_export_rep'
    AND revoked_at IS NULL
  RETURNING assignment_id
)
SELECT extensions.is((SELECT count(*) FROM revoked), 1::bigint, 'Kofi can revoke a previous rep role');
SELECT extensions.lives_ok(
  $$INSERT INTO app.staff_role_assignment (user_id, role_key, assigned_by)
    VALUES ('00000000-0000-4000-8000-000000000013', 'sea_export_rep', '00000000-0000-4000-8000-000000000011')$$,
  'Kofi can assign Yaw the new sea-export role'
);
SELECT extensions.is((SELECT count(*) FROM app.audit_event), 9::bigint, 'Kofi can review all role and membership audit events');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000013';

SELECT extensions.ok(app.current_user_can_manage_workflow('sea', 'export'), 'Yaw receives the newly assigned sea-export scope');
SELECT extensions.ok(NOT app.current_user_can_manage_workflow('air', 'export'), 'Yaw no longer has the revoked air-export scope');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000012';

WITH revoked AS (
  UPDATE app.staff_role_assignment
  SET revoked_at = now()
  WHERE user_id = '00000000-0000-4000-8000-000000000011'
    AND role_key = 'super_admin'
    AND revoked_at IS NULL
  RETURNING assignment_id
)
SELECT extensions.is((SELECT count(*) FROM revoked), 0::bigint, 'Kojo cannot change staff roles');
SELECT extensions.is((SELECT count(*) FROM app.audit_event), 0::bigint, 'Kojo cannot read audit events');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000011';

WITH revoked AS (
  UPDATE app.customer_membership
  SET revoked_at = now()
  WHERE user_id = '00000000-0000-4000-8000-000000000021'
    AND company_id = '10000000-0000-4000-8000-000000000001'
    AND revoked_at IS NULL
  RETURNING membership_id
)
SELECT extensions.is((SELECT count(*) FROM revoked), 1::bigint, 'Kofi can revoke a customer-company membership');
SELECT extensions.is((SELECT count(*) FROM app.audit_event), 10::bigint, 'membership revocation is written to the audit log');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000021';

SELECT extensions.is((SELECT count(*) FROM app.customer_record), 0::bigint, 'Abena loses customer-record access when membership is revoked');

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
