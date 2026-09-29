-- Private bucket for job documents (C1). All access goes through the API using
-- the server-side key; no storage policy is created, so anon and authenticated
-- clients can neither list nor read nor write objects directly.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-documents',
  'job-documents',
  false,
  26214400,
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
