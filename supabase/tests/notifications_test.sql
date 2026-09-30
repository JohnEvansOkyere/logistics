BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(8);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'app.notification', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'app.notification_delivery', 'SELECT')
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.notification'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'app.notification_delivery'::regclass),
  'notifications are private: no grants and row level security is on'
);

INSERT INTO app.customer_company (company_id, company_name)
VALUES ('00000000-0000-4000-8000-0000000005ba', 'Synthetic Notify Ltd');
INSERT INTO app.customer_contact (contact_id, company_id, contact_name, email)
VALUES ('00000000-0000-4000-8000-0000000005c0', '00000000-0000-4000-8000-0000000005ba', 'Ama', 'ama@example.test');

SELECT extensions.ok(
  (SELECT notify FROM app.customer_contact WHERE contact_id = '00000000-0000-4000-8000-0000000005c0')
  AND (SELECT phone FROM app.customer_contact WHERE contact_id = '00000000-0000-4000-8000-0000000005c0') IS NULL,
  'a contact is notified by default and has no phone until one is given'
);

INSERT INTO app.notification (notification_id, company_id, event, dedupe_key, subject, body, sms_text)
VALUES ('00000000-0000-4000-8000-0000000005e0', '00000000-0000-4000-8000-0000000005ba',
        'message', 'test:1', 'Subject', 'Body', 'Short');

SELECT extensions.throws_ok(
  $$INSERT INTO app.notification (company_id, event, dedupe_key, subject, body, sms_text)
    VALUES ('00000000-0000-4000-8000-0000000005ba', 'message', 'test:1', 'S', 'B', 'X')$$,
  '23505', NULL, 'the same event cannot be queued twice'
);
SELECT extensions.throws_ok(
  $$UPDATE app.notification SET subject = 'Changed'$$,
  'P0001', 'notifications are append-only', 'a notification cannot be edited'
);

INSERT INTO app.notification_delivery (delivery_id, notification_id, channel, recipient)
VALUES ('00000000-0000-4000-8000-0000000005d0', '00000000-0000-4000-8000-0000000005e0',
        'email', 'ama@example.test');

SELECT extensions.throws_ok(
  $$INSERT INTO app.notification_delivery (notification_id, channel, status)
    VALUES ('00000000-0000-4000-8000-0000000005e0', 'sms', 'sent')$$,
  '23514', NULL, 'a sent delivery needs its sent time'
);
SELECT extensions.throws_ok(
  $$UPDATE app.notification_delivery SET channel = 'sms'$$,
  'P0001', 'delivery identity fields are immutable', 'a delivery keeps its channel and recipient'
);
UPDATE app.notification_delivery SET status = 'sent', sent_at = now(), attempts = 1
WHERE delivery_id = '00000000-0000-4000-8000-0000000005d0';
SELECT extensions.throws_ok(
  $$UPDATE app.notification_delivery SET status = 'pending'$$,
  'P0001', 'a sent delivery cannot change', 'a sent delivery is final'
);
SELECT extensions.throws_ok(
  $$DELETE FROM app.notification_delivery$$,
  'P0001', 'deliveries cannot be deleted', 'deliveries cannot be deleted'
);

SELECT * FROM extensions.finish();
ROLLBACK;
