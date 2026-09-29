-- Job documents (C2/C3): a document belongs to one job and has a type; every
-- upload is an immutable version pointing at a randomly named storage object.

CREATE TABLE app.document (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  document_type text NOT NULL CHECK (document_type IN (
    'bill_of_lading', 'airway_bill', 'commercial_invoice', 'packing_list',
    'customs_document', 'delivery_note', 'eir', 'supplier_invoice',
    'disbursement_evidence', 'office_letter', 'other'
  )),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX document_job ON app.document (job_id, created_at);

CREATE TABLE app.document_version (
  version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES app.document (document_id),
  version_number integer NOT NULL CHECK (version_number >= 1),
  original_filename text NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 200),
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  object_key text NOT NULL UNIQUE,
  uploaded_by uuid NOT NULL REFERENCES auth.users (id),
  uploaded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (document_id, version_number)
);

CREATE FUNCTION app.prevent_document_version_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'document versions are immutable';
END;
$$;

REVOKE ALL ON FUNCTION app.prevent_document_version_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER document_version_immutable
  BEFORE UPDATE OR DELETE ON app.document_version
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_document_version_change();

ALTER TABLE app.document ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.document_version ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.document, app.document_version
  FROM PUBLIC, anon, authenticated;
