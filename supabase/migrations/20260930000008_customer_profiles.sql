ALTER TABLE app.customer_company
  ADD COLUMN trading_name text,
  ADD COLUMN registration_number text,
  ADD COLUMN tax_number text,
  ADD COLUMN phone text,
  ADD COLUMN company_email text,
  ADD COLUMN website text,
  ADD COLUMN business_address text,
  ADD COLUMN billing_address text,
  ADD COLUMN country text;

ALTER TABLE app.customer_contact
  ADD COLUMN role text,
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

WITH primary_contacts AS (
  SELECT DISTINCT ON (company_id) contact_id
  FROM app.customer_contact
  ORDER BY company_id, created_at, contact_id
)
UPDATE app.customer_contact AS contact
SET is_primary = true
FROM primary_contacts
WHERE contact.contact_id = primary_contacts.contact_id;

CREATE UNIQUE INDEX customer_contact_one_primary_per_company
  ON app.customer_contact (company_id)
  WHERE is_primary;
