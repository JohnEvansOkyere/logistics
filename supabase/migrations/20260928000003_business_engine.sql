CREATE TABLE app.customer_contact (
  contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.customer_company (company_id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customer_contact_company_name
  ON app.customer_contact (company_id, contact_name);

CREATE TABLE app.quote_request (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  customer_company_id uuid REFERENCES app.customer_company (company_id) ON DELETE SET NULL
);

CREATE INDEX quote_request_created_at
  ON app.quote_request (created_at DESC, request_id DESC);

CREATE INDEX quote_request_customer_company
  ON app.quote_request (customer_company_id, created_at DESC);

CREATE TABLE app.quote_draft (
  draft_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES app.quote_request (request_id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.quote_draft_revision (
  revision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES app.quote_draft (draft_id) ON DELETE CASCADE,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  saved_by uuid NOT NULL REFERENCES auth.users (id),
  UNIQUE (draft_id, revision_number)
);

CREATE INDEX quote_draft_revision_history
  ON app.quote_draft_revision (draft_id, revision_number DESC);

CREATE FUNCTION app.prevent_quote_draft_revision_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'quote draft revisions are immutable';
END;
$$;

REVOKE ALL ON FUNCTION app.prevent_quote_draft_revision_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_draft_revision_immutable
  BEFORE UPDATE OR DELETE ON app.quote_draft_revision
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_quote_draft_revision_change();

CREATE TABLE app.super_admin_bootstrap_claim (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  claimed_user_id uuid NOT NULL REFERENCES auth.users (id),
  claimed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.super_admin_bootstrap_claim (singleton, claimed_user_id)
SELECT true, assignment.user_id
FROM app.staff_role_assignment AS assignment
WHERE assignment.role_key = 'super_admin'
  AND assignment.revoked_at IS NULL
LIMIT 1;

ALTER TABLE app.customer_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quote_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quote_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quote_draft_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.super_admin_bootstrap_claim ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  app.customer_contact,
  app.quote_request,
  app.quote_draft,
  app.quote_draft_revision,
  app.super_admin_bootstrap_claim
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC, anon, authenticated;
