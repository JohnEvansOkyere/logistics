ALTER TABLE quote_request
  ADD COLUMN customer_company_id TEXT REFERENCES customer_company (id) ON DELETE SET NULL;

CREATE INDEX quote_request_customer_company
  ON quote_request (customer_company_id, created_at DESC);
