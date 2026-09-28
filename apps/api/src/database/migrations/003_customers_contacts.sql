CREATE TABLE customer_company (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE customer_contact (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES customer_company (id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX customer_company_name
  ON customer_company (company_name COLLATE NOCASE);

CREATE INDEX customer_contact_company
  ON customer_contact (company_id);

CREATE INDEX customer_contact_name_email
  ON customer_contact (contact_name COLLATE NOCASE, email COLLATE NOCASE);
