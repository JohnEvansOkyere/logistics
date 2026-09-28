# Conceptual data model

Design target for Supabase PostgreSQL. The first access-control foundations are versioned under `supabase/migrations/`; the business entities below remain conceptual and are not yet implemented. Business tables belong in a non-exposed schema (e.g. `app`), with a server-owned API and tested access policy (see [security](security-operations.md)).

## Entities and links

| Area | Core records | Key relationships / invariants |
| --- | --- | --- |
| Identity | `user_profile`, `customer_company`, `customer_contact`, `customer_membership`, `staff_role` | `user_profile.auth_user_id` references Supabase Auth identity; company membership checked for each portal query, not inferred from email domain. |
| Sales | `quote_request`, `quote`, `quote_version`, `quote_line` | Versions immutable once issued; accepted version connects to zero or one job; quote history survives job creation. |
| Work | `job`, `job_party`, `task`, `milestone_event`, `exception` | Unique `job.file_number` generated transactionally; job is assigned to one customer, service and direction; events append-only with actor/source/visibility. |
| Shipment | `shipment`, `shipment_reference`, `container`, `transport_leg`, `driver`, `vehicle` | Separate B/L, air-waybill, booking and container references; one job can have many containers/legs; driver details snapshotted on issued waybill. |
| Finance | `charge`, `invoice`, `invoice_line`, `payment_record`, `disbursement`, `financial_adjustment` | Money uses decimal/minor units, never floating point; explicit ISO currency; payment records belong to an invoice/customer, record external method/reference/recording actor; paid/outstanding derived from valid ledger entries. |
| Evidence | `document`, `document_version`, `document_extraction`, `extracted_field`, `approval`, `generated_document` | Private object path, checksum, media type, job owner, visibility, uploader; proposed fields do not modify trusted job data until approved; approval records reviewer and before/after values. |
| Communication | `message`, `notification_attempt`, `contact_consent`, `tracking_observation` | Message channel, recipient, template, job and visibility; retries keyed idempotently; carrier observation keeps source and raw timestamp. |
| Fulfilment | `waybill`, `delivery_proof`, `container_return`, `eir`, `warehouse_location`, `stock_movement` | Waybill and receipt retain issued versions; warehouse balance is sum of immutable stock movements, with atomic issue checks. |
| Governance | `audit_event`, `number_sequence` | Audit actor/time/action/target and relevant before/after; separate safe public IDs from internal numeric sequences; retain history for access and finance changes. |

## Constraints and search

- Enforce foreign keys, unique job/issued-document numbers, quote-to-job uniqueness, positive/nonnegative money as applicable, nonnegative authorised stock, and explicit foreign-currency amounts/tax components.
- Do not use one free-text `status` as the only source of truth for customs, delivery and container return; persist milestone history and evidence links.
- Search indexes: job number; customer + creation date; B/L or air-waybill; container; document type/date; invoice due date; optionally full-text metadata. Index according to measured queries, not every column.
- Mark document, contact and financial visibility independently; portal list and download queries must filter both company membership and record-level approval.
- Prefer append/correction events over deleting issued or audited records. Use timestamps in UTC and render in `Africa/Accra`; store source local dates where legally relevant.
- Decide whether a customer can access historic jobs after contact removal, and retention/deletion/export policy, before implementing portal history.
