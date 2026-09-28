# Agent instructions — BJH Logistics

This repository has an **early local development foundation; it is not production software**. Read [README.md](README.md), [docs/decisions.md](docs/decisions.md), [docs/product.md](docs/product.md), [docs/architecture.md](docs/architecture.md), [docs/workflows.md](docs/workflows.md), then the relevant [CHECKLIST.md](CHECKLIST.md) phase before work. Existing `client_message_extract.md`, `second_meeting_message.md`, `adress.md` and `EVIDENCES/` are client material: preserve them; do not commit or upload them without permission. Use synthetic/redacted fixtures.

## Work agreement

- Execute one bounded outcome per change: state goal, affected requirement IDs, constraints and a verifiable definition of done; note assumptions and unresolved [Dxx decisions](docs/decisions.md). Ask about business/legal/visibility rules rather than inventing them.
- Follow dependencies in [docs/delivery-plan.md](docs/delivery-plan.md); discovery runs in parallel with foundation and other independent work. Use reversible, documented assumptions where safe. Do not mark a checklist item done until code, tests and relevant review/acceptance evidence exist. Record the evidence alongside or in the linked work item. An unresolved high-priority decision blocks final acceptance of its dependent behavior, not beginning development.
- Prefer the simplest implementation consistent with the [architecture](docs/architecture.md); no generic workflow engine, unrequested microservices, payment gateway or unsanctioned carrier scraping. Make scoped diffs; do not change unrelated client files.
- Recheck current official provider docs before implementing integrations. Use stub/sandbox providers locally; do not send client samples or production secrets to coding tools or OCR without permission.
- Database schema/grants/buckets: use reviewed `supabase/migrations/` SQL only. Never alter remote production schema in dashboard, reset remote DB, or deploy from an agent session without an explicit deployment request. Keep environment credentials out of git and web bundles.
- API is authoritative for business data and permissions; client browser uses Supabase Auth only for sign-in/session. Enforce company isolation on API queries, document downloads and generated links; do not trust client-supplied roles/company IDs. Extracted document fields remain drafts until human approval. Staff record external payments only.
- For each change, add focused tests for affected rules/access boundaries, run relevant lint/typecheck/tests/build and inspect the diff; report what ran and what could not run. Review security, data migrations and user-visible changes with a human before release. Keep docs/checklist aligned with implementation.

## Planned repo and commands

Target: `apps/web` (Next.js), `apps/api` (NestJS), `apps/worker` (BullMQ), `packages/contracts`, `supabase/migrations`, `docs`. The initial `apps/web` and `apps/api` workspaces, private-schema PostgreSQL migrations, foundational staff/customer access tables, local pgTAP tests and root scripts exist; worker, contracts, the complete business schema, Redis and API authorization remain planned. Local app development currently uses SQLite behind the API database boundary. The local PostgreSQL tests do not validate Nest API/company isolation. Node.js, pnpm and Supabase CLI are pinned in the root files. Run Supabase reset and tests only against the **local** Supabase instance; never link or deploy from an agent session without an explicit request. Docker supports the local stack. Do not report commands as passed before running them.

## Completion rule

Demonstrate behavior against the acceptance row in [docs/product.md](docs/product.md) and workflow in [docs/workflows.md](docs/workflows.md); verify cross-customer denial and safe failure paths where applicable; update [CHECKLIST.md](CHECKLIST.md) only for verified work. Provide a short handoff with changed paths, test output, outstanding decision IDs and next executable step. This documentation alone is **not** authorization to start the production build.
