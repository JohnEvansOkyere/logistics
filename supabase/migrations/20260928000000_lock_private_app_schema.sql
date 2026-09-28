-- Keep the production business schema outside the Supabase Data API schemas.
-- Later migrations must add explicit API-side privileges only after review.
CREATE SCHEMA IF NOT EXISTS app;

REVOKE ALL ON SCHEMA app FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA app
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA app
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
