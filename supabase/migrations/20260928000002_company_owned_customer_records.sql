DROP POLICY customer_record_read_published_company_member
  ON app.customer_record;

ALTER TABLE app.customer_record
  DROP COLUMN client_visible,
  DROP COLUMN published_by,
  DROP COLUMN published_at;

CREATE POLICY customer_record_read_company_member
  ON app.customer_record
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM app.customer_membership AS membership
      WHERE membership.company_id = customer_record.company_id
        AND membership.user_id = (SELECT auth.uid())
        AND membership.revoked_at IS NULL
    )
  );
