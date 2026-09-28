# Architecture and planned repository layout

## Decision: a modular monolith

Use a `pnpm` TypeScript workspace. **Next.js** renders staff and client UIs; **NestJS on Node.js** is the sole business API; **Supabase-managed PostgreSQL** stores production business data; **Supabase Auth** manages identities; **Supabase Storage** holds private originals and generated PDFs; **Redis + BullMQ** runs scheduled/integration tasks with a separately deployable worker process. Email, SMS and an OCR provider are adapters around domain modules; WhatsApp may be added after launch. Avoid microservices and duplicate persistence frameworks until justified.

### Temporary local database for foundation work

The default developer workflow (`pnpm dev`, also available as `pnpm supabase:dev`) starts the local Supabase stack if needed, applies pending local migrations without resetting data, and points both apps to local Supabase Auth/PostgreSQL for that run. `pnpm supabase:prepare` prepares the same stack without starting the apps; `pnpm supabase:stop` stops the local services while preserving their data. The API uses the `DatabasePort` boundary; SQLite migrations remain available for focused tests, while Supabase migrations are the schema source for the local integration stack. Super-admin bootstrap is enabled only by the local Supabase development command and is rejected when `NODE_ENV=production`.

The local Supabase API gateway is enabled for Auth; only `public` and `graphql_public` are exposed, while business tables remain in the private `app` schema. Versioned PostgreSQL migrations create the role/access foundation, quote requests, customer contacts and quote drafts/revisions; business tables remain denied to `anon` and `authenticated`, with the trusted Nest API connection performing persistence. pgTAP tests cover the access foundation using synthetic fixtures. Local fixtures do not prove hosted Supabase or production isolation, and this workflow does not link or deploy to a hosted project.

Before production, provision a least-privilege API database role, implement admin-managed user and company assignments, and enforce the confirmed company rules at the Nest API boundary. Add the future business tables through reviewed, versioned Supabase migrations rather than SQLite migrations. Current local PostgreSQL tests do not prove production company authorization or release acceptance.

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

The local foundation pins Node.js `22.22.3`, pnpm `12.6.0`, and Supabase CLI `2.118.0`. Root scripts cover `dev`, `lint`, `format:check`, `typecheck`, `test`, `test:e2e`, and `build`; `supabase:dev`, `supabase:prepare`, `supabase:test`, and `supabase:stop` manage the local PostgreSQL integration stack without a reset. No hosted project is linked. Before production work, implement admin-managed user provisioning and company membership checks, complete production authorization, add Redis/provider configuration and deployment checks, and establish separate environments. Protect deployment credentials and run production migrations via a single controlled release path, not manual dashboard edits.

Hosting choice (web/API/worker + managed Redis), region, costs and backup targets must be signed off in [decisions](decisions.md). Supabase's database backups do not alone restore Storage objects: plan an independent document backup/export and test both together.
