-- Provisional access-control schema. The app schema remains private and the
-- Nest API is not connected to this local PostgreSQL project yet.

CREATE TABLE app.staff_role_assignment (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role_key text NOT NULL CHECK (
    role_key IN (
      'super_admin',
      'air_import_rep',
      'air_export_rep',
      'sea_import_rep',
      'sea_export_rep'
    )
  ),
  assigned_by uuid NOT NULL REFERENCES auth.users (id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);

CREATE UNIQUE INDEX staff_role_assignment_one_active_role
  ON app.staff_role_assignment (user_id, role_key)
  WHERE revoked_at IS NULL;

CREATE TABLE app.audit_event (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.customer_company (
  company_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.customer_membership (
  membership_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.customer_company (company_id),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users (id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE UNIQUE INDEX customer_membership_one_active_company_link
  ON app.customer_membership (company_id, user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE app.customer_record (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.customer_company (company_id),
  record_type text NOT NULL CHECK (
    record_type IN ('invoice', 'waybill', 'receipt', 'other')
  ),
  reference text NOT NULL,
  client_visible boolean NOT NULL DEFAULT false,
  published_by uuid REFERENCES auth.users (id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    NOT client_visible
    OR (published_by IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE INDEX customer_record_company_type
  ON app.customer_record (company_id, record_type);

CREATE FUNCTION app.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.staff_role_assignment AS assignment
    WHERE assignment.user_id = (SELECT auth.uid())
      AND assignment.role_key = 'super_admin'
      AND assignment.revoked_at IS NULL
  );
$$;

CREATE FUNCTION app.current_user_can_read_workflow(
  requested_mode text,
  requested_direction text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.staff_role_assignment AS assignment
    WHERE assignment.user_id = (SELECT auth.uid())
      AND assignment.revoked_at IS NULL
      AND (
        assignment.role_key = 'super_admin'
        OR (assignment.role_key = 'air_import_rep'
          AND requested_mode = 'air' AND requested_direction = 'import')
        OR (assignment.role_key = 'air_export_rep'
          AND requested_mode = 'air' AND requested_direction = 'export')
        OR (assignment.role_key = 'sea_import_rep'
          AND requested_mode = 'sea' AND requested_direction = 'import')
        OR (assignment.role_key = 'sea_export_rep'
          AND requested_mode = 'sea' AND requested_direction = 'export')
      )
  );
$$;

CREATE FUNCTION app.current_user_can_manage_workflow(
  requested_mode text,
  requested_direction text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.staff_role_assignment AS assignment
    WHERE assignment.user_id = (SELECT auth.uid())
      AND assignment.revoked_at IS NULL
      AND (
        (assignment.role_key = 'air_import_rep'
          AND requested_mode = 'air' AND requested_direction = 'import')
        OR (assignment.role_key = 'air_export_rep'
          AND requested_mode = 'air' AND requested_direction = 'export')
        OR (assignment.role_key = 'sea_import_rep'
          AND requested_mode = 'sea' AND requested_direction = 'import')
        OR (assignment.role_key = 'sea_export_rep'
          AND requested_mode = 'sea' AND requested_direction = 'export')
      )
  );
$$;

CREATE FUNCTION app.guard_staff_role_assignment_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF ROW(
    NEW.assignment_id,
    NEW.user_id,
    NEW.role_key,
    NEW.assigned_by,
    NEW.assigned_at
  ) IS DISTINCT FROM ROW(
    OLD.assignment_id,
    OLD.user_id,
    OLD.role_key,
    OLD.assigned_by,
    OLD.assigned_at
  ) THEN
    RAISE EXCEPTION 'role assignments are immutable; revoke and assign a new role';
  END IF;

  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'a role assignment can only be revoked once';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION app.audit_staff_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_name text;
  event_actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_name := 'staff_role_assigned';
    event_actor := COALESCE((SELECT auth.uid()), NEW.assigned_by);
  ELSE
    event_name := 'staff_role_revoked';
    event_actor := (SELECT auth.uid());
  END IF;

  INSERT INTO app.audit_event (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    event_details
  ) VALUES (
    event_actor,
    event_name,
    'staff_role_assignment',
    NEW.assignment_id,
    jsonb_build_object(
      'user_id', NEW.user_id,
      'role_key', NEW.role_key
    )
  );

  RETURN NEW;
END;
$$;

CREATE FUNCTION app.guard_customer_membership_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF ROW(
    NEW.membership_id,
    NEW.company_id,
    NEW.user_id,
    NEW.granted_by,
    NEW.granted_at
  ) IS DISTINCT FROM ROW(
    OLD.membership_id,
    OLD.company_id,
    OLD.user_id,
    OLD.granted_by,
    OLD.granted_at
  ) THEN
    RAISE EXCEPTION 'customer memberships are immutable; revoke and grant a new membership';
  END IF;

  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'a customer membership can only be revoked once';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION app.audit_customer_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_name text;
  event_actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_name := 'customer_membership_granted';
    event_actor := COALESCE((SELECT auth.uid()), NEW.granted_by);
  ELSE
    event_name := 'customer_membership_revoked';
    event_actor := (SELECT auth.uid());
  END IF;

  INSERT INTO app.audit_event (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    event_details
  ) VALUES (
    event_actor,
    event_name,
    'customer_membership',
    NEW.membership_id,
    jsonb_build_object(
      'company_id', NEW.company_id,
      'user_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.current_user_is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app.current_user_can_read_workflow(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app.current_user_can_manage_workflow(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app.guard_staff_role_assignment_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.audit_staff_role_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.guard_customer_membership_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.audit_customer_membership() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.current_user_is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app.current_user_can_read_workflow(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION app.current_user_can_manage_workflow(text, text) TO authenticated;

CREATE TRIGGER guard_staff_role_assignment_update
  BEFORE UPDATE ON app.staff_role_assignment
  FOR EACH ROW
  EXECUTE FUNCTION app.guard_staff_role_assignment_update();

CREATE TRIGGER audit_staff_role_assignment_insert
  AFTER INSERT ON app.staff_role_assignment
  FOR EACH ROW
  EXECUTE FUNCTION app.audit_staff_role_assignment();

CREATE TRIGGER audit_staff_role_assignment_revoke
  AFTER UPDATE OF revoked_at ON app.staff_role_assignment
  FOR EACH ROW
  EXECUTE FUNCTION app.audit_staff_role_assignment();

CREATE TRIGGER guard_customer_membership_update
  BEFORE UPDATE ON app.customer_membership
  FOR EACH ROW
  EXECUTE FUNCTION app.guard_customer_membership_update();

CREATE TRIGGER audit_customer_membership_insert
  AFTER INSERT ON app.customer_membership
  FOR EACH ROW
  EXECUTE FUNCTION app.audit_customer_membership();

CREATE TRIGGER audit_customer_membership_revoke
  AFTER UPDATE OF revoked_at ON app.customer_membership
  FOR EACH ROW
  EXECUTE FUNCTION app.audit_customer_membership();

ALTER TABLE app.staff_role_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.customer_company ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.customer_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.customer_record ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON app.staff_role_assignment TO authenticated;
GRANT SELECT ON app.audit_event TO authenticated;
GRANT SELECT ON app.customer_company TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app.customer_membership TO authenticated;
GRANT SELECT ON app.customer_record TO authenticated;

CREATE POLICY staff_role_assignment_read_self_or_super_admin
  ON app.staff_role_assignment
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT app.current_user_is_super_admin())
  );

CREATE POLICY staff_role_assignment_insert_super_admin
  ON app.staff_role_assignment
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT app.current_user_is_super_admin())
    AND assigned_by = (SELECT auth.uid())
  );

CREATE POLICY staff_role_assignment_revoke_super_admin
  ON app.staff_role_assignment
  FOR UPDATE
  TO authenticated
  USING ((SELECT app.current_user_is_super_admin()))
  WITH CHECK (
    (SELECT app.current_user_is_super_admin())
    AND revoked_at IS NOT NULL
  );

CREATE POLICY audit_event_read_super_admin
  ON app.audit_event
  FOR SELECT
  TO authenticated
  USING ((SELECT app.current_user_is_super_admin()));

CREATE POLICY customer_company_read_member_or_super_admin
  ON app.customer_company
  FOR SELECT
  TO authenticated
  USING (
    (SELECT app.current_user_is_super_admin())
    OR EXISTS (
      SELECT 1
      FROM app.customer_membership AS membership
      WHERE membership.company_id = customer_company.company_id
        AND membership.user_id = (SELECT auth.uid())
        AND membership.revoked_at IS NULL
    )
  );

CREATE POLICY customer_membership_read_self_or_super_admin
  ON app.customer_membership
  FOR SELECT
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND revoked_at IS NULL)
    OR (SELECT app.current_user_is_super_admin())
  );

CREATE POLICY customer_membership_insert_super_admin
  ON app.customer_membership
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT app.current_user_is_super_admin())
    AND granted_by = (SELECT auth.uid())
  );

CREATE POLICY customer_membership_revoke_super_admin
  ON app.customer_membership
  FOR UPDATE
  TO authenticated
  USING ((SELECT app.current_user_is_super_admin()))
  WITH CHECK (
    (SELECT app.current_user_is_super_admin())
    AND revoked_at IS NOT NULL
  );

CREATE POLICY customer_record_read_published_company_member
  ON app.customer_record
  FOR SELECT
  TO authenticated
  USING (
    client_visible
    AND EXISTS (
      SELECT 1
      FROM app.customer_membership AS membership
      WHERE membership.company_id = customer_record.company_id
        AND membership.user_id = (SELECT auth.uid())
        AND membership.revoked_at IS NULL
    )
  );
