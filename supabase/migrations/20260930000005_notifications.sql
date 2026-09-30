-- Customer notifications (H3/H4/H6). Every message to a client goes through an
-- outbox: one notification per event, and one delivery per recipient and
-- channel (email or SMS). A background dispatcher sends pending deliveries,
-- retries failures with a growing delay, and leaves failures visible. A
-- dedupe key makes the same event impossible to send twice.

-- Contacts can be reached by SMS, and can be switched off for notifications.
ALTER TABLE app.customer_contact
  ADD COLUMN phone text CHECK (phone IS NULL OR length(phone) BETWEEN 5 AND 40),
  ADD COLUMN notify boolean NOT NULL DEFAULT true;

CREATE TABLE app.notification (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.customer_company (company_id),
  job_id uuid REFERENCES app.job (job_id),
  event text NOT NULL CHECK (length(event) BETWEEN 1 AND 60),
  dedupe_key text NOT NULL UNIQUE CHECK (length(dedupe_key) BETWEEN 1 AND 200),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 300),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  sms_text text NOT NULL CHECK (length(sms_text) BETWEEN 1 AND 700),
  link_url text CHECK (link_url IS NULL OR length(link_url) <= 500),
  created_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX notification_company ON app.notification (company_id, created_at DESC);
CREATE INDEX notification_job ON app.notification (job_id, created_at DESC);

CREATE TABLE app.notification_delivery (
  delivery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES app.notification (notification_id),
  contact_id uuid REFERENCES app.customer_contact (contact_id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 1000),
  provider text,
  provider_message_id text,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT notification_delivery_sent_check CHECK ((status = 'sent') = (sent_at IS NOT NULL))
);

CREATE INDEX notification_delivery_due
  ON app.notification_delivery (next_attempt_at) WHERE status = 'pending';
CREATE INDEX notification_delivery_notification
  ON app.notification_delivery (notification_id);

-- A notification never changes; a delivery keeps its identity and only moves
-- through its sending status.
CREATE FUNCTION app.protect_notification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'notifications are append-only';
END;
$$;

CREATE FUNCTION app.protect_notification_delivery()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'deliveries cannot be deleted';
  END IF;
  IF NEW.notification_id IS DISTINCT FROM OLD.notification_id
    OR NEW.channel IS DISTINCT FROM OLD.channel
    OR NEW.recipient IS DISTINCT FROM OLD.recipient
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'delivery identity fields are immutable';
  END IF;
  IF OLD.status IN ('sent', 'skipped') THEN
    RAISE EXCEPTION 'a % delivery cannot change', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.protect_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_notification_delivery() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notification_protect
  BEFORE UPDATE OR DELETE ON app.notification
  FOR EACH ROW EXECUTE FUNCTION app.protect_notification();

CREATE TRIGGER notification_delivery_protect
  BEFORE UPDATE OR DELETE ON app.notification_delivery
  FOR EACH ROW EXECUTE FUNCTION app.protect_notification_delivery();

ALTER TABLE app.notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.notification, app.notification_delivery
  FROM PUBLIC, anon, authenticated;
