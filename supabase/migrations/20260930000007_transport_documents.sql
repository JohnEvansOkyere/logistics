-- BJH's own house documents (G5): house bills of lading, house air waybills
-- and air manifests, prepared from a job. A document is a draft until issued;
-- issuing needs its number (typed by staff, unique among issued documents of
-- that kind) and freezes it. A mistake is corrected by voiding the document,
-- which frees its number, and issuing a new one.

CREATE TABLE app.transport_document (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  kind text NOT NULL CHECK (kind IN ('house_bl', 'house_awb', 'air_manifest')),
  document_number text CHECK (document_number IS NULL OR length(document_number) BETWEEN 1 AND 80),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'void')),
  fields jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(fields) = 'object'),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  issued_by uuid REFERENCES auth.users (id),
  issued_at timestamptz,
  voided_by uuid REFERENCES auth.users (id),
  voided_at timestamptz,
  void_reason text CHECK (void_reason IS NULL OR length(void_reason) BETWEEN 1 AND 500),
  CONSTRAINT transport_document_issue_check CHECK (
    (issued_at IS NULL) = (issued_by IS NULL)
    AND (status <> 'issued' OR (issued_at IS NOT NULL AND document_number IS NOT NULL))
    AND (status <> 'draft' OR issued_at IS NULL)
  ),
  CONSTRAINT transport_document_void_check CHECK (
    (status = 'void') = (voided_at IS NOT NULL)
    AND (voided_at IS NULL) = (voided_by IS NULL)
    AND (voided_at IS NULL) = (void_reason IS NULL)
  )
);

CREATE INDEX transport_document_job ON app.transport_document (job_id, created_at);

-- A number belongs to one issued document of a kind; voiding one frees it.
CREATE UNIQUE INDEX transport_document_number_unique
  ON app.transport_document (kind, upper(document_number))
  WHERE status = 'issued';

CREATE FUNCTION app.protect_transport_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'transport documents cannot be deleted; void them instead';
  END IF;
  IF OLD.status = 'void' THEN
    RAISE EXCEPTION 'a voided document cannot change';
  END IF;
  IF NEW.job_id IS DISTINCT FROM OLD.job_id
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'document identity fields are immutable';
  END IF;
  IF OLD.status = 'issued' THEN
    IF NEW.status <> 'void'
      OR ROW(NEW.document_number, NEW.fields, NEW.issued_by, NEW.issued_at)
         IS DISTINCT FROM ROW(OLD.document_number, OLD.fields, OLD.issued_by, OLD.issued_at) THEN
      RAISE EXCEPTION 'an issued document is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.protect_transport_document() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER transport_document_protect
  BEFORE UPDATE OR DELETE ON app.transport_document
  FOR EACH ROW EXECUTE FUNCTION app.protect_transport_document();

ALTER TABLE app.transport_document ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.transport_document FROM PUBLIC, anon, authenticated;
