# Architecture and planned repository layout

## Decision: a modular monolith

Use a `pnpm` TypeScript workspace. **Next.js** renders staff and client UIs; **NestJS on Node.js** is the sole business API; **Supabase-managed PostgreSQL** stores production business data; **Supabase Auth** manages identities; **Supabase Storage** holds private originals and generated PDFs; **Redis + BullMQ** runs scheduled/integration tasks with a separately deployable worker process. Email, SMS and an OCR provider are adapters around domain modules; WhatsApp may be added after launch. Avoid microservices and duplicate persistence frameworks until justified.

### Temporary local database for foundation work

The API's default local database remains the ignored SQLite file at `.local/logistics.sqlite`, accessed through `DatabasePort`. Local SQLite migrations live in `apps/api/src/database/migrations/` and run at API startup or via `pnpm --filter @bjh/api db:migrate`. If `DATABASE_URL` is set, Nest selects a PostgreSQL pool for a read-only readiness probe and verifies TLS using the Supabase root CA at `DATABASE_SSL_CA_PATH`. This opt-in connection does not apply migrations or enable PostgreSQL business persistence.

An optional database-focused local Supabase setup is configured in `supabase/config.toml`. Versioned PostgreSQL migrations create an unexposed `app` schema, foundational role assignments and audit events, customer-company memberships, and customer-visible record metadata; default schema access remains denied to `anon` and `authenticated`. pgTAP tests cover company visibility, the four workflow scopes, super-admin role assignment/revocation, and log access using rolled-back synthetic fixtures. This setup is not connected to the Nest API, does not establish the full product schema or D04 policy matrix, and does not link to a hosted Supabase project.

Before moving business data to PostgreSQL, translate its remaining schema into reviewed, versioned SQL under `supabase/migrations/`; do not apply SQLite migrations to PostgreSQL. Add and review business-table grants/RLS, storage policies, and company-isolation behavior, then extend the readiness-only provider behind `DatabasePort` to implement the approved business persistence. Integrate the approved roles with real Supabase Auth identities and enforce authorization at the Nest API boundary. Current local PostgreSQL tests validate only the foundational schema and test fixture predicates, not API authorization or release acceptance.

```text
staff/client browser
   |-- Supabase Auth sign-in/session refresh (no direct business-table access)
   +-- Next.js web app --> NestJS API (validate Auth JWT + company/role permissions)
                              |-- PostgreSQL business schema (Supabase-hosted)
                              |-- private Supabase Storage (API brokers access)
                              +-- Redis queue --> NestJS worker --> OCR / carriers / email / SMS
```

For production, use **Supabase CLI SQL migrations as the only schema/policy/bucket definition source**. The API/worker use a typed Postgres access layer (proposed: Kysely + `pg`, generated DB types); do not also use Prisma-managed migrations. Keep direct database credentials and Storage privileged key only in trusted API/worker environments; provision least-privilege DB roles where possible. Design business tables in an unexposed schema, restrict/disable the Data API for business data, and test grants/RLS if any tables are exposed. The API verifies Supabase JWT signatures and claims, then performs **server-side per-record authorization**; JWT alone is not a customer-company permission check. Next.js must never import privileged credentials. Storage downloads require API authorization before short-lived signed URL issuance or streaming. No public evidence buckets. The SQLite prototype does not implement or verify these production controls.

## Planned full repository layout

```text
apps/
  web/                 Next.js staff + client routes/components
  api/                 NestJS controllers, domain modules, authorization, persistence
  worker/              BullMQ consumers and schedules, reusing backend modules
packages/
  contracts/           API DTO/schema definitions only, no secrets or DB connection
supabase/
  config.toml           Supabase local configuration
  migrations/           SQL schema, roles/grants, policies, bucket definitions
  seed.sql              synthetic development data only
docs/                  product, architecture, runbooks, decisions
.github/workflows/      CI and controlled deployments
```

NestJS modules: identity/access, customers, quoting, jobs/workflows, shipment/tracking, transport/warehouse, billing, documents/extraction, communication, audit. Controllers validate inputs; domain services enforce transitions/transactions; adapters implement external provider interfaces. Avoid a generic workflow-engine platform until real examples justify one. REST `/api/v1` + generated OpenAPI for the web client; protect client-owned resources at query **and** action level. A public quote-request entry point, if desired, needs separate spam/rate limits and explicit approval.

## Environment and build loop

The local foundation pins Node.js `22.22.3`, pnpm `12.6.0`, and Supabase CLI `2.118.0`. Root scripts cover `dev`, `lint`, `format:check`, `typecheck`, `test`, `test:e2e`, and `build`; opt-in `supabase:start`, `supabase:reset`, `supabase:test`, and `supabase:stop` manage the local PostgreSQL verification stack. The Nest API still uses SQLite and no hosted project is linked. Before production work, finish the business schema and API integration, validate the approved D04 matrix against real API operations, add Redis/provider configuration and CI, and establish separate environments. Protect deployment credentials and run production migrations via a single controlled release path, not manual dashboard edits.

Hosting choice (web/API/worker + managed Redis), region, costs and backup targets must be signed off in [decisions](decisions.md). Supabase's database backups do not alone restore Storage objects: plan an independent document backup/export and test both together.
