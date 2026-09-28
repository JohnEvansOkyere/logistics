CREATE TABLE quote_draft (
  id TEXT PRIMARY KEY,
  quote_request_id TEXT NOT NULL UNIQUE REFERENCES quote_request (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE quote_draft_revision (
  id TEXT PRIMARY KEY,
  quote_draft_id TEXT NOT NULL REFERENCES quote_draft (id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (quote_draft_id, revision_number)
);

CREATE INDEX quote_draft_revision_history
  ON quote_draft_revision (quote_draft_id, revision_number DESC);
