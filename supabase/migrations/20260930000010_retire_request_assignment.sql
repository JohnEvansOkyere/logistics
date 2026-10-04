-- Retire the department assignment on quote requests. It only existed to
-- decide who could read or edit the free-text quote draft, which was retired
-- in 20260930000009. Nothing else read it, and no rows existed locally.

ALTER TABLE app.quote_request DROP COLUMN assigned_department_role;

DROP TABLE app.quote_request_assignment_history;
DROP FUNCTION app.prevent_quote_request_assignment_history_change();
