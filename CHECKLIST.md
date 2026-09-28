# Master build and launch checklist

**Status: phase 1 foundation in progress.** This is the full production target, not a claim that a phase is complete. Track completion with `[x]` only after implementation, verification and human sign-off where requested; add a dated evidence link/command result under the relevant phase. If a feature is deferred or dropped, record the client's scope decision in [docs/decisions.md](docs/decisions.md). Pxx maps to [product requirements](docs/product.md); Dxx maps to [decision register](docs/decisions.md). The API still uses local SQLite. Local PostgreSQL migrations provide foundational staff-role, audit, customer-membership and company-owned record policies; the Nest API integration, complete business schema, production isolation verification, deployment checks and other unchecked foundation requirements remain outstanding.

## 0 — Discovery alongside development (confirm before dependent acceptance/release)

These boxes may remain open while phase 1 and independent work proceed. They gate only the specific business behavior they affect; see [delivery plan](docs/delivery-plan.md).

- [ ] D01–D02: agree first-release job types, sea/air step/evidence lists, cancellation and closure override policy.
- [ ] D03: accountant approves tax, currency, invoice, correction, numbering and due-date rules.
- [x] D04: confirmed 2026-09-28 — `super_admin` creates user accounts and assigns roles; each user sees all business records belonging to explicitly assigned company memberships and no other company's records. API-level enforcement remains in Phase 1 items below.
- [ ] D05: confirm privacy/retention, hosting region, OCR permission, backups and recovery objectives.
- [ ] D06: obtain authorised redacted templates/samples for quote, invoice, waybill, POD and EIR.
- [ ] D07–D12: assign answers/owners/dates; defer integration-dependent acceptance explicitly where needed. D13 is post-launch.

## 1 — Reproducible foundation

- [ ] Bootstrap pinned Node LTS + pnpm workspace (`apps/web`, `apps/api`, `apps/worker`, `packages/contracts`), strict TypeScript, formatting, linting and root scripts.
- [ ] Add `.gitignore`, `.env.example`, secret validation and explicit prohibition of real client documents in fixtures or committed files.
- [ ] Configure Docker-supported local Supabase/Redis, SQL migrations, synthetic seed and clean-reset instructions; prepare separate staging/production projects once region/hosting decisions are made.
- [ ] Add migration-controlled business schema, grants, bucket policies, private Storage and access tests; disable/restrict business Data API.
- [ ] Implement Supabase Auth invitation/sign-in/session handling, NestJS JWT verification and role/company membership checks (P01/P10).
- [ ] Verify denied cross-customer API/search/file/link access, revoked memberships and least-privilege staff operations in automated tests.
- [ ] Establish CI for lint, typecheck, unit, migration/integration, E2E and build; document runnable local and staging setup.
- [ ] Add health checks, structured redacted logs, error monitoring and audited permission changes.

## 2 — Customer, quotation, job and archive

- [ ] P01: create/search customer profiles, contacts and customer/company membership history.
- [ ] P02: quote requests, editable drafts, immutable issued versions, acceptance/rejection and prior quote history.
- [ ] P02/P03: one accepted quote creates at most one job under retries; direct jobs obey approved policy; collision-safe job number under concurrency.
- [ ] P03/P04: job detail, parties, modes/services, owners, tasks, milestone timeline, exceptions and role-based transitions.
- [ ] P08/P14: upload originals privately with type/size checks, versions, checksum, job/type metadata and indexed search; signed download after authorization.
- [ ] P14: audit quote-to-job and role/visibility changes; demonstrate finding a years-old synthetic job/document.

## 3 — Import/export and finance

- [ ] P04: sea import: docs, arrival, customs assessment, invoice/charges, release, inspection, delivery, empty return/EIR, closure.
- [ ] P04: sea export: booking, container/loading, customs/terminal, departure and final paperwork, closure.
- [ ] P04: air import/export: flight/air-waybill, customs, airline/airport charges, release/departure and closure, no container EIR requirement.
- [ ] P05: manual ETA/milestones, source timestamps, correction history, client-approved visibility and conflict handling.
- [ ] P06: quote vs actual charge separation, issued/revised invoice/PDF with approved tax/currency/due-date and unique numbering.
- [ ] P06: partial/multiple external payment records, receipt reference/evidence, reversal/audit, allocations and correct outstanding balance; no checkout.
- [ ] P07: numbered waybill with frozen driver/vehicle/cargo snapshot, dispatch, signed POD, damage notes, container-return EIR and closure gates.
- [ ] Test blocked invalid status transitions, missing evidence, partial payment, failed delivery, finance arithmetic and concurrent issue/payment operations.

## 4 — Client, warehouse and independent road freight

- [ ] P10: invite client contacts, self-service quote requests, authenticated own-job tracking link and approved milestone/ETA views.
- [ ] P10: client document/waybill/invoice downloads obey company membership and document approval/visibility; test attempts to guess IDs.
- [ ] P12: warehouse locations, received stock, partial picks, immutable movement ledger, no negative stock, dated stock reports and billing.
- [ ] P13: standalone transport quotation/job, truck/driver assignment, waybill, destination status, POD and billing.
- [ ] Exercise sea/air, warehouse, road and portal flows in browser E2E with synthetic companies.

## 5 — Notifications and extraction

- [ ] P11: job-linked email sends/manual correspondence log, approved templates, consent and delivery attempt history.
- [ ] P11: SMS sender/provider with verified Ghana coverage, recipient consent, agreed events/templates, sandbox tests, retry/deduplication and failure visibility.
- [ ] P05: assess actual carrier/airline APIs/aggregator terms, coverage and cost; implement confirmed adapters or signed-off manual flow.
- [ ] P05/P11: approved ETA changes trigger timezone-correct reminders without duplicate sends or internal data leakage.
- [ ] P09: trial OCR on authorised redacted examples; document per-field accuracy, scan failure rates, price and data handling.
- [ ] P09: private upload → worker → isolated draft/provenance → staff compare/correct/approve → transactional trusted update; manual fallback.
- [ ] Test malicious/invalid upload, retries, stale extraction, reviewer permissions and that drafts cannot enter invoices/portal/authoritative job fields.

## 6 — Production quality, security and recovery

- [ ] Run full CI, E2E and UAT matrix covering all P01–P14 and independent customer access denial.
- [ ] Run threat/access review: ID enumeration, client isolation, storage URLs, JWT/session handling, staff finance changes, rate limits and audit integrity.
- [ ] Review Supabase Security Advisor, grants/RLS on any exposed tables, private Storage policies, SSL and account MFA; verify secrets absent from frontend and git.
- [ ] Profile representative jobs/documents, add indexes as measured, load-test staging and monitor queue/cost/storage growth.
- [ ] Configure and prove database **and Storage object** backup/restore with agreed RPO/RTO; document retention, export and deletion processes.
- [ ] Rehearse controlled migration, rollback/forward-fix, provider outage, worker replay and correction of bad invoices/ETA in staging.
- [ ] Establish production dashboards/alerts, runbooks, support ownership, incident escalation and cost limits.
- [ ] Train staff, complete signed operational and portal UAT, approve generated documents, make release decision and perform monitored launch.

## 7 — Post-launch enhancement (does not block initial release)

- [ ] D13: agree whether/when to add WhatsApp, account ownership, eligible notifications, opt-in, templates and costs.
- [ ] P11 later channel: add official WhatsApp Business adapter, sandbox and consent/visibility/retry tests, with email/SMS continuing to work.

## Evidence log

Add entries as work completes, e.g. `2026-10-02 — P02 accepted quote idempotency: pnpm test (pass), staging demo link, reviewer`.

- 2026-09-28 — Local foundation bootstrap: pinned pnpm workspace with Next.js and NestJS, API health endpoint, versioned local SQLite migration, and smoke test against a fresh temporary DB. Passed: `corepack pnpm install --frozen-lockfile`, `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, `corepack pnpm test` (1 smoke test), `corepack pnpm test:e2e` (1 smoke test), and `corepack pnpm build`; a root `dev` launch returned the web page and migrated API health response. This is partial foundation evidence only; it does not verify PostgreSQL permissions, Supabase access controls, authentication, or company isolation.
- 2026-09-28 — Local PostgreSQL access foundation: `corepack pnpm supabase:reset` applied both versioned migrations; `corepack pnpm supabase:test` passed 59 pgTAP assertions for private-schema isolation, four-rep workflow CRUD, super-admin role assignment/audit, company-scoped published customer records, known-ID cross-company denial, and membership revocation. `corepack pnpm supabase:stop` stopped the local stack. This does not verify Nest API authorization, complete business behavior, or hosted Supabase settings.
- 2026-09-28 — Synthetic document preview and brand palette: `/documents-preview` served quote, draft invoice, transport-field layout, and payment-receipt samples (HTTP 200 after `corepack pnpm build`); built CSS includes the logo-derived deep/light blues. `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e`, and `corepack pnpm build` passed. Preview data are fictional/placeholders; no legal document is issued.
- 2026-09-28 — D06 review convenience: each synthetic `/documents-preview` sample has an individually named print control. `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, and `corepack pnpm build` passed; a headless Chrome print-media check confirmed each target prints alone, controls are hidden, and selecting the receipt button targets the receipt. This remains layout-review evidence only; D03/D06 document approval is outstanding.
- 2026-09-28 — Frontend workspace shell: the home route renders responsive navigation, empty customer/quotation/job module shells, an explicit no-data notice, and links to the document preview and API health routes. `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, and `corepack pnpm build` passed; headless Chrome verified the page at 390px and 1280px with no horizontal overflow and checked the empty state/navigation. No Supabase/Auth connection or business records are implemented by this UI scaffold.
- 2026-09-28 — P01 customer-directory UI prototype: `/customers` searches four explicitly synthetic profiles by company, contact name, or email and provides no-match/clear states. `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, and `corepack pnpm build` passed; headless Chrome verified all three search fields, the no-match/clear path, the synthetic-data notice, and layouts at 390px/1280px without horizontal overflow. This is a frontend prototype only; it does not complete P01, connect to an API, or implement customer membership/portal authorization.
- 2026-09-28 — P01 synthetic profile-detail UI: directory entries open pre-rendered fictional profile pages with contact details and clearly unconnected quote/job history sections. The existing lint, format, typecheck and build checks passed; headless Chrome verified directory/profile/back navigation, the empty history messaging, mobile layout, and a safe 404 for an unknown sample ID. No business records or authorization behavior are implemented.
- 2026-09-28 — P02 quotation-request UI prototype: `/quotations` shows searchable synthetic requests, with detail pages and local-only sample/empty/loading/error state previews. `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, and `corepack pnpm build` passed; headless Chrome verified search, all preview states, detail/back navigation, no pricing/job actions, a safe 404 for unknown IDs, and responsive 390px/1280px layouts. State previews make no business-data requests; P02 remains unchecked, and quote terms, issuance, and job creation are not implemented.
- 2026-09-28 — P02 request-intake form preview: `/quotations/new-request` previews generic company/contact/email/message fields locally, with edit/clear and no submission or persistence. Headless Chrome verified required-field/email validation, the review/edit/clear flow, no non-GET request during interaction, and 390px/1280px layouts. This is not a public intake endpoint or approved production form; request scope and fields remain provisional.
- 2026-09-28 — API Postgres readiness provider: `DATABASE_URL` selects a `pg` pool for encrypted, CA-verified `SELECT 1`; absent `DATABASE_URL` preserves SQLite. `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, `corepack pnpm test` (4 passed), `corepack pnpm test:e2e` (4 passed), and `corepack pnpm build` passed. Hosted API health returned HTTP 503 because `.local/supabase-root.crt` is not present; the earlier psql probe does not verify Node's CA validation. No remote schema was changed; this provider does not implement business persistence or authorization.
- 2026-09-28 — D04 access rules confirmed by the user and recorded in `docs/decisions.md`: super admin creates accounts and assigns roles; customer access is scoped to all business records belonging to explicitly assigned companies, with no cross-company access or document-type publication gate. This closes the discovery question; API-level access enforcement remains unimplemented and unchecked.
- 2026-09-28 — Company-owned customer records: local migration removes the per-record publication gate and grants reads by active company membership only. `corepack pnpm supabase:reset` applied all three migrations and `corepack pnpm supabase:test` passed 61 assertions, including visibility of all five own-company records, denial by another company's known record ID, and revocation denial. `corepack pnpm supabase:stop` stopped the local stack. Nest API authorization remains unimplemented and unverified.
- 2026-09-28 — P02 quote-request intake slice: SQLite migration `002_quote_requests.sql` and NestJS endpoints create, list, and retrieve requests; the existing form, inbox, and detail screen use the API. `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test` (8 passed), `corepack pnpm test:e2e` (8 passed), and `corepack pnpm build` passed. API tests verify trimming/validation, retrieval, unknown IDs, and persistence across API restart. This is local synthetic-data scaffolding; P02 remains unchecked because quotation drafting/versions, pricing, issue/acceptance, and job conversion are not implemented.
- 2026-09-28 — P01 local customer directory slice: company/contact tables and API create/search/detail endpoints use SQLite; the customer directory, create form, and profile view now use those endpoints. Same-name submissions remain distinct rather than auto-merging. API tests cover company/contact creation, company/contact/email search, validation, detail retrieval, same-name record separation, and persistence after API restart. Authentication is now partially implemented; company memberships, additional-contact entry, issued quote history, and job history remain unimplemented. P01 remains unchecked.
- 2026-09-28 — P01/P02 explicit request association: local migration `004_quote_request_customer_link.sql` links a quote request only after staff selects a customer company; linked requests appear in the company profile history. No name-based auto-match is performed. API tests cover association, filtered history, unknown company denial, and persistence after restart. Quote pricing and job creation remain unimplemented.
- 2026-09-28 — Local Auth slice: `/sign-in` supports first-account signup and later sign-in; the first authenticated local user can claim `super_admin` once. Nest verifies Supabase JWT claims and requires an active super-admin role for customer/quotation API routes. `corepack pnpm test` and `corepack pnpm test:e2e` each passed 15 assertions, including bootstrap closure and role denial using synthetic verifier identities. Local Supabase Auth health returned HTTP 200; no account was created in this session. Phase 1 Auth remains unchecked pending admin-managed staff provisioning, company memberships/isolation, and live Auth acceptance.
