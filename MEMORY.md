Maintain a file called MEMORY.md. After any significant decision, about direction, format, content, approach, or strategy, add an entry:

## [Date], [Decision]

**What was decided:** [the choice made]
**Why:** [the reasoning]
**What was rejected:** [alternatives considered and why they were ruled out]

Read MEMORY.md at the start of every session before doing anything. Never contradict a logged decision without flagging it first.

## 2026-09-28, D04 company access and role administration

**What was decided:** The super admin creates user accounts and assigns roles in the admin section. Customer access follows explicit company assignment: each user sees all business records belonging to assigned companies and no records belonging to other companies; no per-record publication gate or document-type list.
**Why:** The user reconfirmed that each company should see all data belonging to it and no other company's data, and that role assignment is administered dynamically.
**What was rejected:** Repeating questions about role names, staff names, multi-company access, and customer-visible record types; these are superseded by the confirmed access model.

## 2026-09-28, Local super-admin bootstrap

**What was decided:** Use Supabase Auth locally for signup/sign-in. The first authenticated user can claim the single `super_admin` role once; Nest verifies Supabase JWT claims and requires that role for current staff business APIs. Store this temporary bootstrap role in local SQLite; later accounts are to be created and assigned by the super admin.
**Why:** The user wants to sign up the super admin and use that account for local testing while continuing to build.
**What was rejected:** An open repeatable super-admin signup or using the hosted Supabase project for the local testing account.

## 2026-09-28, First business-engine slice

**What was decided:** Start P02 with local SQLite persistence for quote requests and a connected staff inbox/detail form; do not include authentication, pricing, quote acceptance, or job creation in this slice.
**Why:** It turns the existing local-only intake preview into the first runnable business flow while D03/D12 pricing and job-number rules remain open.
**What was rejected:** Starting with authentication or treating this request-intake slice as the full quote-to-job engine.

## 2026-09-28, Customer record creation behavior

**What was decided:** Model customer companies and contacts separately in local SQLite; create a company with its initial contact; search across company name, contact name and email. Same-name company submissions create distinct records rather than auto-merging.
**Why:** This supports P01 while avoiding silent merging without an agreed duplicate-resolution rule.
**What was rejected:** Automatic company matching/merging during intake.

## 2026-09-28, Quote request company association

**What was decided:** Staff explicitly links a quote request to a customer company from the request detail view; the company profile then shows its linked requests.
**Why:** This connects P01 and P02 without inferring that a request and customer are the same solely because their names match.
**What was rejected:** Automatic request-to-customer matching by company-name text.

## 2026-09-28, Quote draft content and revisions

**What was decided:** The local draft slice stores one editable plain-text body per explicitly customer-associated quote request. Each save appends an immutable numbered content snapshot; request and customer history expose revision count and latest save time. Drafts cannot be read or saved before explicit association.
**Why:** This provides editable, traceable local work while D03 and D06 still govern approved pricing, tax, terms, numbering, and issued-document structure.
**What was rejected:** Inventing structured rates, currency/tax fields, legal terms, quote issuance or acceptance, or job creation in this slice.

## 2026-09-28, Supabase-first local integration and confirmed D03/D06/D12

**What was decided:** Use the local Supabase stack for Auth and business persistence during development, with a scripted start/migrate/app launch and a data-preserving stop command. D03 settings are configurable by authorized BJH users without legal/tax assumptions; department reps prepare operational records and documents for super-admin approval (D06); quote acceptance applies to the identified quote version and records actor/time, with no separate evidence attachment or historic import (D12).
**Why:** The user wants production-directed builds to exercise Supabase earlier and explicitly answered these discovery decisions.
**What was rejected:** Switching this testing slice to a hosted Supabase project, resetting or clearing local data during development, reopening answered D03/D06/D12 questions, or adding quote issuance/job creation to the draft slice.

## 2026-09-28, Operations-first dashboard presentation

**What was decided:** Present the home screen around customer and quotation tasks, with a concise request-to-draft handoff and honest local-environment labeling. Do not show invented workload metrics or unfinished jobs as active modules.
**Why:** The user said the dashboard looked too much like a demo platform; task-first navigation better reflects current usable workflows without overstating implementation.
**What was rejected:** Sample-data cards, fake counts, and an unfinished Jobs destination in primary navigation.

## 2026-09-28, Dashboard brand colors

**What was decided:** Use the documented BJH deep blue (`#0B3FAE`) and light blue (`#5C9FD6`) palette for the dashboard, with neutral surfaces and green reserved for connection status.
**Why:** The user asked for the dashboard colors to match the logo; the brand guide records these approximate logo colors.
**What was rejected:** The green-led dashboard palette.

## 2026-09-28, Local pgTAP fixture isolation

**What was decided:** Scope role and audit-event count assertions to the synthetic identities created by the test transaction so the access suite also passes against a persistent local database.
**Why:** The local database can contain a durable super-admin role and audit history; whole-table counts incorrectly treated those legitimate rows as test failures.
**What was rejected:** Resetting the local database before tests or counting unrelated durable rows as part of the fixture.

## 2026-09-28, Local web development port

**What was decided:** Run the local web app on port 3002, keep the API on 3001, and provide a web-only Supabase dev command for cases where the API is already running.
**Why:** Port 3000 was occupied by an existing web dev process, while the local API was already serving on 3001.
**What was rejected:** Replacing or terminating the existing port-3000 process to start another copy.

## 2026-09-28, D04 staff administration slice

**What was decided:** Put staff Auth administration behind super-admin-guarded Nest endpoints. Keep Supabase service-role credentials in the API process only; invite accounts into a password-setup route; preserve role assignment/revocation history; and enforce the single active `super_admin` invariant in PostgreSQL.
**Why:** The confirmed D04 workflow says the super admin creates accounts and assigns roles, while browser code must not hold privileged credentials and local tests must not send real invitations.
**What was rejected:** Calling Supabase Auth Admin from the browser, testing by sending client invitations, allowing super-admin role reassignment through the staff form, or replacing immutable role history with in-place edits.

## 2026-09-28, Persistent local singleton test fixture

**What was decided:** Before inserting pgTAP's synthetic super-admin, temporarily revoke the already-persisted local singleton inside the test's outer transaction; the final rollback restores it. Keep the database-level duplicate-role assertion and retain the no-reset local test workflow.
**Why:** The new partial unique index correctly rejected the test's fixed synthetic super-admin when a durable local admin already existed. The suite must validate the invariant against persistent local data without clearing that data.
**What was rejected:** Removing the singleton invariant, resetting the local database, or weakening the test to avoid exercising the unique constraint.

## 2026-09-28, Sidebar settings grouping

**What was decided:** Keep system status under a SETTINGS sidebar group, below the main workspace navigation, and share that group between the overview and staff-access screens. Do not add links for settings workflows that do not exist yet.
**Why:** The user wants settings grouped together in the lower sidebar area, and System status is the only available settings-related destination today.
**What was rejected:** Leaving System status in the top bar or linking to placeholder settings features.

## 2026-09-28, Settings hub clarification

**What was decided:** Treat Settings as a hub in the lower sidebar, with distinct pages for Staff management and System status. Move staff management to `/settings/staff` and redirect the former `/admin/users` path there.
**Why:** The user clarified that Settings will contain multiple settings pages and specifically includes staff management; a label grouping System status alone did not meet the requested navigation model.
**What was rejected:** A Settings heading that links directly to System status while staff administration stays in the workspace navigation.

## 2026-09-28, Super-admin account lifecycle

**What was decided:** The super admin directly creates staff accounts, chooses their initial passwords, and manually provides sign-in details. Staff administration supports password replacement and reversible suspension/reactivation; it does not send invitations. Reusing an account keeps all activity attributed to that account, not the person using it.
**Why:** The user specified administrator-managed account creation and control rather than invitation-based onboarding.
**What was rejected:** Requiring invitees to accept an email and set up their own account.

## 2026-09-28, Department staff read access

**What was decided:** Department reps can read all customer profiles and quote-request inbox/details. Customer users remain scoped to active company memberships. Department reps cannot read quote draft content or create, link, or edit records until request assignment exists; the super admin keeps those actions and approves departmental work.
**Why:** Shared customer context supports triage, while draft and write access must wait for department assignment so one role does not prepare another department's work.
**What was rejected:** Denying department staff all shared customer/request reads, or giving them unassigned draft and write access across departments.

## 2026-09-29, Manual quote-request department assignment

**What was decided:** The super admin manually assigns or clears each quote request's air/sea import/export department role. Only active representatives with that assigned role can read or revise the linked quote draft; assignment changes keep actor/time history. Drafts stay unissued for later super-admin review.
**Why:** This implements the department handoff without inferring service type from free-text requests or granting departments access to one another's drafts.
**What was rejected:** Automatic routing from request text and assigning work to named staff instead of the existing role model.

## 2026-09-29, Persistent workspace sidebar

**What was decided:** Keep the shared workspace sidebar available across operational pages, highlight the current section, and make it sticky while scrolling on desktop and mobile. Leave sign-in and account setup pages outside the workspace shell.
**Why:** The user wants navigation to stay within reach while moving among work screens.
**What was rejected:** Page-specific sidebars that disappear on customer and quotation routes or duplicate across different screens.

## 2026-09-29, Project audit deliverables kept local

**What was decided:** Write the engineering + shipping audit to `docs/audit-2026-09-29.md` and the ordered work plan to `docs/implementation-checklist.md`; keep `CHECKLIST.md` as the acceptance/evidence ledger. The audit proposes (not decides) a "job file first" release order and retiring the SQLite adapter — both await Evans's decision.
**Why:** The audit draws on confidential client material, which AGENTS.md forbids uploading without permission; a separate plan avoids rewriting the verified evidence ledger.
**What was rejected:** Publishing the report as a hosted doc/artifact; rewriting CHECKLIST.md in place.

## 2026-09-29, Retire SQLite; direct jobs; light warehouse/road scope

**What was decided:** (1) Retire the SQLite adapter; API tests move to local Supabase PostgreSQL. (2) Jobs open after a client accepts a quote, or directly without a quote for existing clients. (3) Warehousing and road transport are light: simple goods-in/out and driver/truck assignment, not a full inventory system.
**Why:** Evans confirmed each in response to the 2026-09-29 audit; dual adapters doubled work, and the client described both quote-led and direct jobs and a small warehouse operation.
**What was rejected:** Keeping SQLite for focused tests; quote-only job creation; a full stock-ledger warehouse module.

## 2026-09-29, Direct jobs, driver assignment and customer accounts

**What was decided:** Any active staff role can open a job directly without a quote. Existing staff manage warehousing, with no separate role. Road transport work is assigned to a driver. The super admin creates customer accounts the same way as staff accounts.
**Why:** Evans answered the open audit questions.
**What was rejected:** Super-admin-only direct jobs; a dedicated warehouse role; invitation-based customer onboarding.

## 2026-09-29, Drivers are records, not users

**What was decided:** Drivers are stored as name and phone records that staff assign to road trips; they have no sign-in or role.
**Why:** Evans confirmed staff handle driver assignment; drivers do not need system access.
**What was rejected:** A driver sign-in for delivery confirmation from a phone.

## 2026-09-29, Release order: job file first

**What was decided:** Build the staff-only job file first (Release 1: jobs with file numbers, milestone timeline, private document archive/search, manual ETA, supplier-invoice upload, staff notes). Then structured quotes/invoices/payments (R2), customer portal and notifications (R3), automation and other services (R4). Work order follows `docs/implementation-checklist.md`.
**Why:** Evans chose it in response to the audit; it addresses the client's stated pain (finding old job documents) before quote issuance.
**What was rejected:** Keeping the delivery-plan order that puts quote issuance/acceptance ahead of jobs. `docs/delivery-plan.md` still shows the old order and needs aligning (follow-up).

## 2026-09-29, API tests run on local Postgres in a rolled-back transaction

**What was decided:** API e2e tests use local Supabase PostgreSQL. Each test file opens one outer transaction, truncates the `app` tables, seeds synthetic `auth.users`, and rolls back at the end; the API's BEGIN/COMMIT/ROLLBACK become savepoints on one serialized connection (`apps/api/test/postgres-test-database.ts`). `test:e2e` runs files sequentially. `test` now runs only `*.unit-spec.ts`.
**Why:** Keeps local dev data untouched, needs no extra database, and gives fresh state per file like the old temp SQLite files. The `.env` `DATABASE_URL` points at a hosted project, so the harness ignores it and requires the local port.
**What was rejected:** A separate test database (auth schema/FKs make cloning impractical); truncating the dev database (destroys dev data); a `DATABASE_URL` from `.env` (hosted).

## 2026-09-29, Shared request contracts (`@bjh/contracts`)

**What was decided:** `packages/contracts` (zod 4, compiled to `dist` with tsc) holds the request-body schemas for customers, quote requests, quote drafts, department assignment and staff role/create bodies, with the API's existing error wording. API services parse through `parseContract`; web imports the types. Root `typecheck`, `test`, `test:e2e` build contracts first.
**Why:** Removes hand-written duplicate validation and gives web/API one source for shapes (A7).
**What was rejected:** Sharing TypeScript source without a build step (Nest's `tsc` build would compile it into the wrong root); class-validator DTOs (would duplicate types for the web).

## 2026-09-29, SQLite retired; job-number format; local migrations authorised

**What was decided:** SQLite adapter, its migrations, `migrate.ts`, `.local/logistics.sqlite` and `better-sqlite3` were deleted (Evans approved the listed set). `DATABASE_URL` is now required. Job numbers use `BJH/{SI|SE|AI|AE}/{YYYY}/{seq}`. Migrations may be applied to the local Supabase database only.
**Why:** Evans answered these explicitly in-session; one adapter halves feature cost and tests now match the shipping database.
**What was rejected:** Keeping the `.sqlite` file; simpler `BJH-{YYYY}-{seq}` numbering; applying anything to hosted Supabase.

## 2026-09-29, Job visibility scope (assumption pending client confirmation)

**What was decided:** Job reads are scoped: super admin sees all jobs, department reps only jobs on their own service lines, customers only their active companies' jobs. Reps may open jobs only for their own line. File-number sequence pads to 4 digits.
**Why:** B3 asks for department scoping by role; the checklist marks rep-own-line as an assumption, and it is the narrowest option consistent with the existing draft-access model.
**What was rejected:** Letting every rep see every job (as they can for customers and quote requests) until Evans/the client confirms; that would be a one-line widening later.

## 2026-09-29, Sea-import milestones derived from client messages; branch pushed

**What was decided:** B5 milestone template for sea import is taken from the client's own description (14 keys in `packages/contracts`), recorded in any order in an append-only `milestone_event` table (corrections are new events). Other service lines have no template and refuse milestones. Work was pushed to branch `chore/foundation-hardening-and-jobs`.
**Why:** Evans said the workflow should come from the client's messages rather than the earlier draft; it also unblocks B5.
**What was rejected:** Enforcing strict step order (real jobs overlap); inventing templates for the other lines; auto-recording a "file registered" milestone (the job's open time already is that).

## 2026-09-29, Department in charge controls reopen/override; admin activity log

**What was decided:** Reopening a closed/cancelled job and overriding closure are done by the rep for the job's service line (super admin also may), with a written reason; not super-admin-only. No evidence gates (D02 evidence questions were removed by Evans). All authenticated API activity, including denied attempts, goes to an append-only activity log readable only by the super admin (bodies/queries never stored).
**Why:** Evans said the person in charge of the department should hold those powers and that the admin must see everything users do.
**What was rejected:** Super-admin-only reopen (the earlier checklist wording); logging request bodies (could hold passwords); a separate "department head" role for now — if several staff share one rep role they all hold these powers, so a distinct head role may be needed later.

## 2026-09-29, Quote structure, business settings, no GRA

**What was decided:** Structured quote versions follow the EVIDENCES samples (currency, lines with basis fixed/per B/L/per container/at cost, optional 20ft/40ft size, minor-unit amounts, notes). Issuer/currency/tax/prefix/terms live in a Settings screen (super admin edits, every change kept as a revision; who edits doesn't matter to the client). BJH invoices do not go through GRA e-VAT (D15 closed). The old free-text draft stays alongside for now rather than being deleted. Evans authorised pushing the branch.
**Why:** Evans answered D1, F1 and F6 and asked for the answers to be recorded in the questions.
**What was rejected:** Hard-coded currencies/taxes (D03); a GRA e-VAT integration; deleting the free-text draft tables without confirmation.

## 2026-09-29, D01, D02 and D05 cancelled; build the full system

**What was decided:** D01 (first-release job types), D02 (workflow sequence/evidence) and D05 (data ownership/retention) are cancelled. The whole system is in scope; workflows come from the client's extracted messages; the company owns its data. Work now proceeds through everything left in `docs/implementation-checklist.md`.
**Why:** Evans said the full system is being built, the sequences are in the client messages, and a customs system's data belongs to the company.
**What was rejected:** Asking the client to phase job types or validate sequences. Kept as safe defaults (not questions): no third-party OCR of real documents without Evans's permission, and no deployment from an agent session. Region and backup targets remain engineering choices at production setup.

## 2026-09-29, ETA is an append-only history; tasks are role-assigned and internal

**What was decided:** The job's ETA is the newest row of an append-only `eta_event` history (each with a source and optional note; a correction is a new row). Tasks (including exceptions: missing documents, damage, delay) are assigned to a staff role with an optional due date, can be completed once, and are visible to staff only, not customers. Tasks and ETA changes are blocked on closed/cancelled jobs until reopened.
**Why:** E3/E4 require corrections that never overwrite history and a "my department's open tasks" list; customers seeing internal exceptions was not asked for.
**What was rejected:** Editing an ETA in place; customer visibility of tasks (can be opened later, one-line change); reopening a completed task (a new task is created instead).


## 2026-09-29, Quote structure follows the EVIDENCES samples; reps issue quotes directly

**What was decided:** (1) A quote version mirrors the two sample quotations: title/subtitle, scope, intro, charge lines grouped in sections (each line: description, basis fixed / per B/L / per container / at cost, optional basis note, and either one amount or a 20ft and a 40ft amount, in minor units), one currency per quote, at-cost note, clearance steps, required documents and note, timeline, terms, and the BJH/client acceptance block. (2) No admin approval: the rep for the quote's service line (or the super admin) issues a version straight to the customer; the super admin sees every quote, draft and action. An issued version is immutable; a change is a new version. (3) Any rep on the quote's service line, or the super admin, records the client's acceptance or rejection against a specific issued version (assumption: "the various reps"); accepting opens the job in the same step, at most one job per quote. (4) The quote number `BJH/Q/{SI|SE|AI|AE}/{YYYY}/{seq}` is allocated when a quote is first issued, not at draft time. The PDF (D5) follows after the Settings screen (F1).
**Why:** Evans answered D1-D5: match the evidence format, reps can send quotes, admin sees everything, various reps handle decisions.
**What was rejected:** The earlier "rep prepares, super admin approves" gate (D2); a single flat amount per line (the samples show 20ft and 40ft columns); allocating numbers to drafts (would leave gaps in numbers customers see). Boilerplate defaults (steps, terms) are not hard-coded; they belong in Settings (F1), and a new version starts as a copy of the previous one.

## 2026-09-29, Quote decisions: one per version, accepting opens the job and locks the quote

**What was decided:** A client decision (accepted/rejected, with the client's named signatory and time) is recorded by staff against the latest issued version, once per version, append-only. Accepting opens the job in the same transaction (`job.quote_id` is unique, so at most one job per quote) and repeating the same decision returns the same job. An accepted quote can gain no new version and issue no draft; a rejection does not lock it (the rep can issue a new version). Migrations `...09` and `...10` were applied to the local database only.
**Why:** D3/D4 answers: various reps handle decisions; accepting opens the job. Locking after acceptance keeps the accepted terms exactly as agreed.
**What was rejected:** Reversing a decision (a mistaken record needs a new quote version or the super admin's help, not an edit); a separate manual "open job" step after acceptance; letting customers accept themselves before the portal (H) exists.

## 2026-09-29, Business settings are revisioned JSON; they drive quote currency, numbering and defaults

**What was decided:** Settings (issuer, currencies + default, tax lines as basis points, payment terms, quote/invoice/receipt prefixes, quote boilerplate) are stored as append-only revisions; the newest is current. Every staff member reads them, only the super admin saves. Once a revision exists, quotes must use a configured currency, the quote number takes the configured prefix, and the quote editor starts from the defaults. Invoice and receipt prefixes and the tax lines are stored now and used by F3/F5; how levies combine on an invoice is decided with F3.
**Why:** Evans's earlier answer (D03/F1) put currencies, taxes, prefixes and terms in Settings, edited by the super admin with every change kept.
**What was rejected:** Hard-coded currencies/terms; a column per setting (jsonb validated by the shared contract is simpler for a single-tenant config); making settings mandatory before any quote (blocking quotes would stall work; invoices are where the requirement bites).

