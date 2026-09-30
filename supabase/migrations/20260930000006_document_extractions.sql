-- Document extraction drafts (I1). Reading the text layer of an uploaded PDF
-- (a bill of lading, an air waybill) produces a DRAFT list of proposed shipment
-- references. A draft never changes the job: a person reviews it, may correct
-- the values, and approves the ones to apply. The draft's proposed fields never
-- change; only its review status moves from draft to approved or rejected.
-- No third-party service reads the document.

CREATE TABLE app.document_extraction (
  extraction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  document_id uuid NOT NULL REFERENCES app.document (document_id),
  version_number integer NOT NULL CHECK (version_number >= 1),
  -- False for a scanned PDF with no text layer: those need OCR, which is not enabled.
  text_found boolean NOT NULL,
  -- [{key, label, value, sealNumber, evidence}]
  fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fields) = 'array'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  -- What happened to each proposed field when the draft was approved.
  applied jsonb CHECK (applied IS NULL OR jsonb_typeof(applied) = 'array'),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_by uuid REFERENCES auth.users (id),
  reviewed_at timestamptz,
  CONSTRAINT document_extraction_review_check CHECK (
    (status = 'draft') = (reviewed_at IS NULL)
    AND (reviewed_at IS NULL) = (reviewed_by IS NULL)
  )
);

CREATE INDEX document_extraction_job ON app.document_extraction (job_id, created_at DESC);

CREATE FUNCTION app.protect_document_extraction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'extraction drafts cannot be deleted';
  END IF;
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'a reviewed extraction cannot change';
  END IF;
  IF NEW.job_id IS DISTINCT FROM OLD.job_id
    OR NEW.document_id IS DISTINCT FROM OLD.document_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.text_found IS DISTINCT FROM OLD.text_found
    OR NEW.fields IS DISTINCT FROM OLD.fields
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'the proposed fields of an extraction never change';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.protect_document_extraction() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER document_extraction_protect
  BEFORE UPDATE OR DELETE ON app.document_extraction
  FOR EACH ROW EXECUTE FUNCTION app.protect_document_extraction();

-- The document must belong to the same job.
CREATE FUNCTION app.check_document_extraction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app.document WHERE document_id = NEW.document_id AND job_id = NEW.job_id
  ) THEN
    RAISE EXCEPTION 'the document must belong to the same job';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.check_document_extraction() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER document_extraction_check
  BEFORE INSERT ON app.document_extraction
  FOR EACH ROW EXECUTE FUNCTION app.check_document_extraction();

ALTER TABLE app.document_extraction ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.document_extraction FROM PUBLIC, anon, authenticated;
