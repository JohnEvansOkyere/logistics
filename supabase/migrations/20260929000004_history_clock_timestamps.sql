-- History tables order by insertion time; use the wall clock rather than the
-- transaction start so entries written in one transaction still sort correctly.
ALTER TABLE app.job_status_history ALTER COLUMN changed_at SET DEFAULT clock_timestamp();
ALTER TABLE app.milestone_event ALTER COLUMN recorded_at SET DEFAULT clock_timestamp();
ALTER TABLE app.activity_log ALTER COLUMN occurred_at SET DEFAULT clock_timestamp();
