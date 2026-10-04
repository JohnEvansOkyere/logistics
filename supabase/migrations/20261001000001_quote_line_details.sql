-- An optional description under each quote charge, printed below the charge
-- name (for example "Covers terminal handling and gate-in").

ALTER TABLE app.quote_line
  ADD COLUMN details text
    CONSTRAINT quote_line_details_length CHECK (
      details IS NULL OR length(details) <= 500
    );
