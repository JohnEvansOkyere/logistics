# BJH Logistics operations platform

Status: **local development foundation**. The repository has a minimal Next.js web app and NestJS API workspace. The API uses an ignored SQLite database by default and persists local quote requests and customer company/contact records. If `DATABASE_URL` is set, Nest uses a PostgreSQL pool for a readiness-only `SELECT 1` check; PostgreSQL business persistence is not implemented. An optional, database-focused local Supabase setup separately exercises migrations and a synthetic RLS probe. Supabase PostgreSQL remains the production target. These paths do not verify API authorization or production company-isolation behavior.

The product is a job-file system for a Ghana-based freight forwarder: quotations, import/export clearance, air/sea shipments, trucking, warehouse services, billing records, documents, staff tasks, client updates, and a client portal. **Staff record external payments; the app does not take payments.** Client messages use **email and SMS** for the initial production release; WhatsApp is a later enhancement.

## Reading order

1. [Client-friendly questions](questions.md) to share with the client, then [internal decision register](docs/decisions.md) for tracking answers before implementing dependent features.
2. [Product requirements and acceptance criteria](docs/product.md) — what the system must do and for whom.
3. [Operational workflows](docs/workflows.md) — job milestones and closure rules.
4. [Architecture and target repo layout](docs/architecture.md) — Next.js + NestJS + Supabase PostgreSQL/Auth/Storage, with the temporary local SQLite exception.
5. [Data model](docs/data-model.md), [document template blueprint](docs/document-templates.md), and [integrations](docs/integrations.md).
6. [Security and operations](docs/security-operations.md).
7. [Agent execution guide](AGENTS.md), [delivery plan](docs/delivery-plan.md), and [master checklist](CHECKLIST.md).
8. [Research notes and primary sources](docs/research.md).

## Source material and handling

- [Initial process walkthrough](client_message_extract.md): import/export, air/sea, warehousing, road transport, documents and correspondence.
- [Second meeting notes](second_meeting_message.md): quotes-to-jobs, tracking, reminders, assignments, extraction, portal.
- `EVIDENCES/` and `adress.md`: client-provided reference material, **not** seed data or public assets. Handle as confidential; ask before copying, publishing, uploading to third-party services, or committing to a remote repository. Build tests from synthetic/redacted fixtures instead.

Where these sources are incomplete, [docs/decisions.md](docs/decisions.md) explicitly distinguishes confirmed facts from proposals and questions. The documents describe the **entire production destination**, delivered in bounded phases; an unchecked box in [CHECKLIST.md](CHECKLIST.md) is not proof of implementation.

## Local development setup

Prerequisites: Node.js `22.22.3` (also recorded in `.nvmrc`) and Corepack. The repository pins pnpm `12.6.0` in `package.json`.

```sh
corepack pnpm install
cp .env.example .env
corepack pnpm dev
```

Open the web app at <http://127.0.0.1:3000>; the API health endpoint is <http://127.0.0.1:3001/api/health>. Without `DATABASE_URL`, the API creates `.local/logistics.sqlite` and applies pending SQLite migrations in `apps/api/src/database/migrations/` on startup. With `DATABASE_URL`, it uses PostgreSQL for a read-only health probe and does not apply migrations. The database and `.env` are gitignored. To apply SQLite migrations without starting the API, run `corepack pnpm --filter @bjh/api db:migrate`. To reset local SQLite state, stop the API, remove `.local/logistics.sqlite` and its `-shm`/`-wal` sidecars, then run `corepack pnpm --filter @bjh/api db:migrate` or restart the API.

For the optional hosted PostgreSQL readiness probe, keep `DATABASE_URL` and `DATABASE_SSL_CA_PATH` server-side in `.env`. Download the project's root CA from Supabase **Database → SSL Configuration** to the ignored `.local/supabase-root.crt` path (or set `DATABASE_SSL_CA_PATH` to another private local path). This only verifies connectivity; it does not migrate or read business tables.

Open <http://127.0.0.1:3000/documents-preview> to review the synthetic quotation, draft invoice, transport-document field layout, and payment receipt. Use the browser's Print command for one preview per page. These are layout samples only: they use placeholder amounts and do not issue invoices, carrier forms, or receipts.

Run checks from the repository root with `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e`, and `corepack pnpm build`. API tests use a fresh temporary SQLite file and verify the latest migration plus customer and quote-request validation, search, retrieval and restart persistence.

Track verified milestones in [CHECKLIST.md](CHECKLIST.md): its evidence log records completed commands, while unchecked Phase 1 boxes mean the broader production/foundation requirement is still incomplete. The optional PostgreSQL migration/RLS check is documented below and remains separate from the SQLite-backed app.

The SQLite adapter and its migrations are development scaffolding only. The local SQLite business slice currently persists quote requests and customer companies with contacts; it does not yet implement quotations, jobs, shipments, invoices, receipts, or documents. The local PostgreSQL migrations establish the private `app` schema plus staff-role assignments, role-change audit events, customer-company memberships, and company-owned customer record access. They do not implement the business model. The optional Nest PostgreSQL provider currently checks readiness only; it does not use the schema for business operations. Before PostgreSQL business persistence, add reviewed migrations for the agreed schema, least-privilege API grants, and independently tested API authorization. Do not treat local database tests as proof of production business access controls.

### Optional local PostgreSQL and access-control check

Requires Docker with about 7 GB of available memory. The Supabase CLI is pinned in the workspace; the local configuration does not link or log in to a hosted project. The local PostgreSQL service is for migration and SQL-test verification. Supabase Auth is not wired to either app; no application authentication has been implemented. If `DATABASE_URL` is set, API access to PostgreSQL is limited to the read-only readiness probe.

```sh
corepack pnpm supabase:start
corepack pnpm supabase:reset
corepack pnpm supabase:test
corepack pnpm supabase:stop
```

`supabase:reset` recreates **only the local** Supabase database and reapplies `supabase/migrations/`. `supabase:test` runs 61 pgTAP assertions covering private-schema access, company-owned records (including denial by known record ID), CRUD within each of four sea/air workflow scopes, super-admin role assignment/revocation, membership revocation, and audit visibility. Test identities are synthetic fixtures, not fixed user-to-role assignments; identities and records exist only inside a rolled-back transaction. No durable application accounts or seed records are created. This does not connect the Nest API or prove API-level authorization. The first start downloads Supabase container images.
