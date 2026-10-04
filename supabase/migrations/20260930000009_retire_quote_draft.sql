-- Retire the first-generation free-text quote draft. Quotes are now the
-- structured, versioned quotes (app.quote), which already link back to the
-- request they answer through app.quote.quote_request_id. A request's
-- "quote status" is read from that linked quote, so nothing here replaces the
-- draft tables' data.

DROP TABLE app.quote_draft_revision;
DROP TABLE app.quote_draft;
DROP FUNCTION app.prevent_quote_draft_revision_change();
