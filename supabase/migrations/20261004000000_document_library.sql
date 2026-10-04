-- Document library: a document may stand alone (an office letter, a template)
-- instead of belonging to a job, optionally tied to one customer company so
-- that company can read it. A document with a job takes its company from the job.

ALTER TABLE app.document ALTER COLUMN job_id DROP NOT NULL;

ALTER TABLE app.document
  ADD COLUMN company_id uuid REFERENCES app.customer_company (company_id),
  ADD COLUMN title text CHECK (title IS NULL OR length(title) BETWEEN 1 AND 200),
  ADD CONSTRAINT document_one_owner CHECK (job_id IS NULL OR company_id IS NULL);

CREATE INDEX document_company ON app.document (company_id, created_at)
  WHERE company_id IS NOT NULL;
