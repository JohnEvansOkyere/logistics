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
