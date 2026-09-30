-- Manual correspondence log (H5): a record, per job, of emails, WhatsApp
-- messages, calls and letters exchanged with clients and others, kept by staff
-- so old transactions can be traced. Entries are append-only and internal;
-- an attachment is a document already on the same job.

CREATE TABLE app.job_correspondence (
  entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES app.job (job_id),
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms', 'phone', 'letter', 'other')),
  direction text NOT NULL CHECK (direction IN ('received', 'sent')),
  occurred_at timestamptz NOT NULL,
  counterparty text CHECK (counterparty IS NULL OR length(counterparty) BETWEEN 1 AND 200),
  subject text CHECK (subject IS NULL OR length(subject) BETWEEN 1 AND 300),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  document_id uuid REFERENCES app.document (document_id),
  recorded_by uuid NOT NULL REFERENCES auth.users (id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX job_correspondence_job ON app.job_correspondence (job_id, occurred_at);

CREATE FUNCTION app.check_job_correspondence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'correspondence entries are append-only';
  END IF;
  IF NEW.document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.document
    WHERE document_id = NEW.document_id AND job_id = NEW.job_id
  ) THEN
    RAISE EXCEPTION 'an attachment must be a document on the same job';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.check_job_correspondence() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER job_correspondence_check
  BEFORE INSERT OR UPDATE OR DELETE ON app.job_correspondence
  FOR EACH ROW
  EXECUTE FUNCTION app.check_job_correspondence();

ALTER TABLE app.job_correspondence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.job_correspondence FROM PUBLIC, anon, authenticated;
