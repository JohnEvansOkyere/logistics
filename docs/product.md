# Product contract

## Purpose, users and boundaries

One searchable job file replaces scattered correspondence and paper/PDF filing. Staff can tell what remains to be done, what has been billed and paid, and which evidence closes a job. Customers see only their own approved information. The company is the operator; client companies are separate access scopes.

Provisional staff roles supplied by the user are `super_admin`, `air_import_rep`, `air_export_rep`, `sea_import_rep`, and `sea_export_rep`. The super admin assigns roles and reviews logs; each rep is responsible for its sea/air and import/export workflow. Customers see records for their own company, including invoices, waybills, and receipts. The local probe models these scopes only; confirm the complete production permissions, remaining client-visible records, and multi-company membership rule in [D04](decisions.md). Sensitive staff notes, supplier costs, customs/payment evidence and unapproved extraction drafts are never portal-visible by default.

## Required capabilities and acceptance examples

| ID | Capability | Demonstrable acceptance result |
| --- | --- | --- |
| P01 | Customer/contact management | Staff can search customer profiles and contacts and view prior quote/job history; a client contact sees only assigned company records. |
| P02 | Quote requests and quotations | Client submits a request; staff draft, revise, issue and record acceptance/rejection of a priced quote; acceptance creates a job at most once, with link to the accepted version. |
| P03 | Job registration | A job has a unique human-readable file number, service/direction/mode, customer, staff owner, dates, parties, cargo references, and an auditable status timeline. Multiple containers and document references are possible. |
| P04 | Clearance and shipment work | Staff track the sea/air import/export milestones in [workflows](workflows.md), assign tasks, record exceptions and upload release/delivery evidence; closure is blocked until required steps or documented overrides are complete. |
| P05 | Tracking and ETA | Staff can enter and correct an ETA with source; arrivals/departures and exceptions are visible internally; carrier-fed updates, where available, are flagged as external observations and reconciled before publishing. |
| P06 | Charges, invoices and receivables | Quote charges and actual costs are distinct; staff issue versioned invoices with due dates and tax/currency details as approved, record partial external payments and receipts/references, and see accurate outstanding balances. No in-app payment collection. |
| P07 | Delivery and transport | Generate controlled-number waybills with driver, vehicle, cargo and destination; record signed proof of delivery; for containerized import record empty return and EIR before ordinary closure. |
| P08 | Document archive and search | Original files are private, linked to a job and document type, versioned where replaced, downloadable only with access checks; searchable metadata enables retrieval years later. |
| P09 | Extraction with human approval | Extract proposed B/L and air-waybill fields from digital/scanned documents; show original beside draft, allow correction, record reviewer and source, and apply only approved values to trusted records. Unsupported/failed documents go to manual entry. |
| P10 | Client portal | An invited client can request a quote, follow their own approved job milestones/ETA, and download approved invoices, waybills and documents; cross-customer access is rejected. |
| P11 | Communications | Staff can send or log job-linked updates; approved milestones may trigger consented email and SMS messages with delivery attempts and retries. Client-facing tracking links require authentication/authorization. |
| P12 | Warehousing | Staff record warehouse locations, receipts, stock quantities and releases; prevent negative stock and produce dated inventory reports/invoices. |
| P13 | Standalone road freight | Request/issue transport quotes and jobs; assign truck/driver, generate waybill, record delivery confirmation and charges independent of customs work. |
| P14 | Audit and retrieval | Search by file number, customer, bill/air-waybill, container, date and document type; log who changed financials, access grants, approvals and job status. Archived jobs remain searchable subject to policy. |

## Explicit system boundaries

- The app **records** external customer payments and operational disbursements; it never charges a card, accepts mobile money, moves funds or claims reconciliation with a bank.
- Clearance and port/terminal/airline payments remain staff actions outside the app unless a confirmed, supported integration is later scoped.
- Carrier tracking depends on carrier access; staff-entered milestones are a supported production path, not a demo fallback.
- Email/SMS are the initial notification channels; WhatsApp is a **post-launch enhancement**, not a launch requirement. Historic email, SMS or WhatsApp conversations cannot be assumed importable. Job-linked communication starts with app-sent messages and staff-logged interactions; automatic import requires separate access and a privacy decision.
- OCR/extraction is assisted data entry, not automated customs submission or a guarantee of perfect recognition.
- Accounting export, multi-currency rules, tax layouts, retention, SLA targets and customer-visible documents must be signed off before dependent implementation; see [decisions](decisions.md).

## Operational qualities (verify at launch)

- Usable on desktop and mobile browsers, including low-bandwidth client views; Ghana local time displayed clearly and UTC used for stored event timestamps.
- Authentication and authorization on every operation; least privilege; private documents; an auditable path from quote to closure.
- Reliable retries for notifications and extraction without duplicate invoices, jobs, payments or client messages.
- Database **and** document-store recovery tested; monitoring, error reporting, and written staff/admin runbooks in place.
