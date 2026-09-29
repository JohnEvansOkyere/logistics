# Implementation checklist — working plan

Derived from [audit-2026-09-29.md](audit-2026-09-29.md). This is the **ordered work plan**; [CHECKLIST.md](../CHECKLIST.md) stays the master acceptance/evidence ledger. Tick an item here when its "done when" is met, then record evidence in CHECKLIST.md.

Ordering assumes the proposed **"job file first"** release shape (audit §3.3). If Evans keeps the current delivery-plan order, move Workstream D (quotes) ahead of B/C. Items marked **⚑** are blocked on a decision.

Each item: requirement IDs · done when.

---

## A — Housekeeping and foundation gaps (do first)

- [ ] **A1** Commit the uncommitted department-assignment slice (22 files + migration) · `git status` clean; migration in history.
- [x] **A2** Gitignore `.playwright-mcp/` · not listed by `git status`.
- [x] **A3** Fix `AGENTS.md` formatting · `pnpm format:check` passes.
- [x] **A4** Align docs with D04: remove "invitation-based" wording from `docs/security-operations.md` and CHECKLIST Phase 1 · no doc contradicts D04.
- [x] **A5** Split `test` vs `test:e2e` scripts (currently identical) · each script runs a distinct set.
- [x] **A6** Retire SQLite adapter (confirmed 2026-09-29): run API tests against local Supabase Postgres with per-test isolation; delete `sqlite-database.service.ts` + SQLite migrations (confirm deletion at the time) · all API tests pass on Postgres; one adapter remains.
- [x] **A7** Add `packages/contracts` with schema validation (e.g. zod) shared by API and web; migrate existing customer/quote-request/staff bodies · API rejects invalid bodies via shared schemas; web imports types from contracts.
- [ ] **A8** CI on GitHub Actions: install (frozen lockfile), lint, format, typecheck, tests against Postgres service, pgTAP, build · green run on a PR. _(2026-09-29: `.github/workflows/ci.yml` written; steps verified locally; green PR run pending)_
- [x] **A9** API hardening: env-driven listen host and CORS origins, security headers, rate limit on auth/bootstrap routes, redacted structured logging · config verified by test; no hard-coded localhost in production path.
- [x] **A10** Resolve roles + memberships once per request into request context; guards read context · one role lookup per request; existing access tests still pass.

## B — Job file core (Release 1) · P03, P04, P14

- [x] **B1** ⚑ Confirm job-number format (D12 open) — propose e.g. `BJH/{SI|SE|AI|AE}/{YYYY}/{seq}` · decision logged.
- [x] **B2** Migration: `job` (file number unique, service/direction/mode, customer company, owner role, status, dates), `number_sequence` with transactional allocation · concurrent-create test yields unique numbers.
- [x] **B3** Job API: create directly without a quote (confirmed: any staff role; reps within their own service line — assumption), list/search, detail; company scoping for customers; department scoping by role · cross-company and wrong-department denial tests.
- [x] **B4** `job_party` (shipper, consignee, notify, agents) and `shipment_reference` with **master/house hierarchy** (MBL/HBL, MAWB/HAWB, booking, container + seal) · one master → many houses supported; search by any reference.
- [x] **B5** Milestone template for **sea import** (D02 draft from `docs/workflows.md`); `milestone_event` append-only with actor, time, source, note · events can't be edited/deleted; correction = new event.
- [x] **B6** Job status transitions (`open → in_progress → on_hold → ready_to_close → closed/cancelled`), reopen needs a reason and the department in charge (or super admin) - per Evans 2026-09-29 · invalid transition tests.
- [x] **B7** Web: job list, create form, job detail with timeline and parties/references · browser check at 390px/1280px. _(2026-09-29: checked in a browser at 1280px and 390px as a sea-import rep: opened a job, recorded a milestone, added a party and a booking; no horizontal page scroll at 390px. Activity log page checked only as a non-admin, which correctly shows the denial.)_
- [x] **B8** Audit events for job create/status/owner changes · audit rows asserted in tests. _(2026-09-29: covered by the activity log — job create, status, milestone, party and reference requests — plus `job_status_history`; there is no separate owner field because ownership is the service line.)_

## C — Document archive (Release 1) · P08, P14

- [x] **C1** Private Supabase Storage bucket via migration; no public access · pgTAP/storage policy test denies anon/authenticated direct access.
- [x] **C2** Upload API: authenticated, job-bound, type/size and magic-byte validation, checksum, random object key, `document` + `document_version` rows · invalid type/oversize rejected.
- [x] **C3** Document types incl. **supplier invoice / disbursement evidence** distinct from BJH invoices · type required on upload.
- [x] **C4** Download via API authorization → short-lived signed URL · cross-company download denied by known ID.
- [x] **C5** Search across file number, customer, B/L/AWB, container, document type, date · synthetic "3-year-old job" retrievable in one search.
- [x] **C6** Web: upload/list/download on job detail; global search · browser check.

## D — Structured quotations · P02

- [x] **D1** Replace free-text draft with `quote_version` + `quote_line` (basis: fixed / per B/L / per container / at cost; container size; minor-unit amount; ISO currency); keep notes field · migration + API tests. _(2026-09-29: layout follows the two EVIDENCES sample quotations; a line carries one amount or a 20ft and a 40ft amount; the old free-text draft is kept alongside, not removed. Web screens typechecked and built, not yet checked in a browser.)_
- [x] **D2** Rep prepares and issues directly to the customer (no approval step, per Evans 2026-09-29); the super admin sees every quote, draft and action; issued version is immutable · edit of issued version rejected. _(2026-09-29: DB triggers and API both refuse edits; a change is a new version.)_
- [x] **D3** Record acceptance/rejection against a specific version (actor, time) · D12 behaviour tested. _(2026-09-29: any rep on the quote's service line or the super admin records it on the client's behalf, with the client's named signatory; only the latest issued version can be decided; append-only. Web form typechecked and built, not yet checked in a browser.)_
- [x] **D4** Accepted quote → at most one job (idempotent under retry) · concurrent-accept test yields one job. _(2026-09-29: accepting opens the job in the same transaction; four simultaneous accepts return the same decision and job. The e2e harness shares one connection, so true parallel connections are covered by the database uniqueness tests, not the HTTP test.)_
- [ ] **D5** Quote PDF from approved template, marked draft until D03 settings configured · preview matches `/documents-preview` layout.

## E — Remaining shipment flows and ETA · P04, P05

- [x] **E1** Sea export milestone template (D02).
- [x] **E2** Air import and air export templates; no EIR requirement for air (D02).
- [x] **E3** Manual ETA entry with source and correction history; exceptions (missing docs, damage, delay) as tasks · correction never overwrites history. _(2026-09-29: API, migration and tests done; the web ETA and task sections are typechecked but not yet checked in a browser.)_
- [x] **E4** Tasks per job assigned to role, with due dates · list "my department's open tasks". _(2026-09-29: `GET /api/v1/tasks?assignedRole=` lists open work, scoped to the caller's service lines; web check pending as above.)_

## F — Finance records · P06

- [x] **F1** Issuer/tax/currency settings screen (D03) — VAT/levies, currencies, numbering; no hard-coded values · settings required before any invoice issues. _(2026-09-29: settings, revisions, currency restriction and quote-number prefix done and tested. "Required before any invoice issues" is enforced when invoices are built (F3). Web form typechecked and built, not yet checked in a browser.)_
- [ ] **F2** Charges: quoted vs actual; disbursements linked to supplier-invoice documents; exchange rate captured per transaction.
- [ ] **F3** Customer invoice versions with unique numbering, due date, tax lines from settings; corrections via revision/credit · issued invoice immutable.
- [ ] **F4** Staff-recorded external payments (partial/multiple), method/reference/evidence, reversal with reason; outstanding balance derived from ledger · arithmetic + over-allocation tests; money in minor units only.
- [ ] **F5** Receipt PDF (conventional receipt, D06) · never implies bank verification.
- [x] **F6** D15 answered by Evans 2026-09-29: BJH invoices do not go through GRA e-VAT; no integration needed.

## G — Delivery paperwork and closure · P07

- [ ] **G1** Drivers/vehicles; numbered waybill with frozen driver/vehicle/cargo snapshot.
- [ ] **G2** POD upload (scanned) with receiver, date/time, damage notes.
- [ ] **G3** Container return + EIR for containerised imports.
- [ ] **G4** Closure gate: required evidence present or approved override · close blocked test.
- [ ] **G5** ⚑ D14: house B/L / HAWB / manifest generation — only if BJH confirms authority and template.

## H — Client portal and notifications · P10, P11

- [ ] **H1** Super admin creates customer-user accounts like staff accounts and links them to a company (confirmed 2026-09-29) · customer signs in and sees only their company.
- [ ] **H2** Customer routes: own jobs, milestones/ETA, documents, invoices, quote requests · guessed-ID denial tests for every resource.
- [ ] **H3** ⚑ Email provider adapter (D08): job-linked messages, templates, consent, delivery attempts, dedupe · sandbox tests only.
- [ ] **H4** ⚑ SMS provider with Ghana coverage (D08) · sandbox tests only.
- [ ] **H5** Manual correspondence log on job (email/WhatsApp notes + attachments) — covers client's current WhatsApp habit until D13.
- [ ] **H6** Worker process + Redis/BullMQ for sends and reminders; idempotent, retry, failure view.

## I — Later services and automation · P05, P09, P12, P13

- [ ] **I1** ⚑ Text-layer extraction for B/L / HAWB PDFs → draft fields → human review → approved apply (D09).
- [ ] **I2** ⚑ OCR for scanned documents only after Evans permits it and a provider trial on redacted samples.
- [ ] **I3** ⚑ Carrier/airline tracking adapters for confirmed carriers only (D07).
- [ ] **I4** Warehousing, light scope (confirmed 2026-09-29): goods received/released per customer, simple location, quantity, no negative stock, basic stock report — no full inventory system · managed by existing staff roles (confirmed).
- [ ] **I5** Standalone road transport, simple scope: assign driver/truck, waybill, delivery confirmation, charges · staff assign a driver record (name, phone); drivers do not sign in (confirmed).

## J — Production readiness (before any real data)

- [ ] **J1** ⚑ Hosting provider/region, staging + production projects (D11).
- [ ] **J2** Least-privilege API DB role; verify isolation on staging.
- [ ] **J3** Backup **and Storage** restore drill with agreed RPO/RTO.
- [ ] **J4** Monitoring, alerts, runbooks; MFA for admin accounts.
- [ ] **J5** Security review (ID enumeration, signed URLs, sessions, finance edits, audit integrity).
- [ ] **J6** Staff training, UAT sign-off, controlled launch.

---

## Client questions to send / chase

- D01, D02, D05 cancelled by Evans 2026-09-29 (full system; workflows from client messages; company owns its data). Nothing outstanding from `questions.md` blocks the build.
- **New D14:** Does BJH issue house B/Ls / house AWBs / manifests itself, and should the system generate them? Numbering format?
- ~~**New D15:** Are BJH customer invoices required to be GRA e-VAT invoices?~~ Answered 2026-09-29: no.
- Confirm R1 communications = app email/SMS + manual log (WhatsApp later), and R1 tracking = staff-entered ETA.
