# Security, quality and operating requirements

These are production acceptance requirements, not claims that controls already exist. Treat customer documents, financial data and shipment information as confidential.

## Access and data protection

- Use Supabase Auth with invitation-based staff/client accounts, verified email and secure session handling; administrator MFA and staff MFA before go-live. Server verifies JWT signature, issuer/expiry/audience; never authorize based solely on a self-supplied company ID or email domain.
- Enforce staff capabilities and client membership on **every** NestJS resource query, mutation, search result, download and signed-link issuance. A company contact must not see another company's job even if they guess an ID. Test cross-company access and revoked membership.
- Keep business tables in a non-exposed schema with restricted DB grants. If any table is exposed through Supabase Data API, enable/test RLS and least-privilege grants first; service-role/secret keys bypass RLS and stay server-only. Use parameterized queries and controlled migrations.
- Use private Storage buckets, random object keys, short-lived downloads, validated content types/sizes, scanning/quarantine and retention policy. Encrypt transport and provider credentials; never log tokens, originals, extracted personal fields or signed URLs.
- Log actor, action, time and target for role/company membership changes, job transitions, quote/invoice issuance, payment entry/reversal and extraction approvals. Protect audit records from ordinary edits; define authorised correction paths, not silent deletion.
- Determine applicable Ghana privacy/tax retention requirements, data-hosting region, provider data-processing agreements and deletion/export rights with the client before live data or third-party OCR use. Avoid production data in test environments or AI-agent prompts.

## Financial and workflow integrity

- Payment records are statements of money received externally, created by authorised staff; capture method, reference, date, amount, currency, optional evidence and recorder. Never present them as bank-verified. Adjust/reverse using linked entries and audited reasons; block over-allocation or require explicit approved credit handling.
- Generate file/invoice/waybill numbers safely under concurrent requests. Issued PDF records are immutable revisions, not overwritten files; report outstanding invoice balance consistently after partial payments/adjustments.
- Queue handlers are idempotent and bounded; failed sends and extraction go to a visible retry/triage view. Avoid automatic client updates from unapproved OCR or unverified carrier observations.

## Verification, deployment and recovery

- Local and CI: formatting/lint, strict typecheck, unit tests for rules, migration reset, database integration tests for authorization/transactions, API tests for quote→job and finance/closure, worker retry/idempotency tests, and browser tests for staff/client journeys.
- Staging: sample _synthetic/redacted_ sea/air, warehouse and road jobs; verify PDF generation, uploads, accessible and denied downloads, partial payments, client visibility, notifications in sandbox mode and OCR failure/review behavior.
- Deploy via reviewed changes, staging migrations and then one controlled production migration path; take pre-migration backup, use compatible/expand-contract changes for rolling releases, and record rollback procedure. No dashboard-only production schema edits.
- Monitor API/worker health, queue backlog, provider errors, document upload failures, notification delivery, DB/storage capacity and slow searches. Provide runbooks for provider outage, stuck job, incorrect invoice, compromised account, backup restore and reprocessing.
- Define recovery point/time targets; verify a restore drill for **both** Supabase Postgres and private Storage objects (database backup alone is insufficient). Check production plan/backup/PITR suitability and retention with client budget.
- Go-live requires operator UAT sign-off on representative workflows, permissions, generated paperwork and restore drill; train staff, assign admin ownership and agree support/escalation process.
