# Operational workflows

These are proposed job templates derived from the two conversations, not hard-coded assertions about customs law. Configure mandatory/optional steps by service after the operator validates them. Store each milestone's actor, timestamp, evidence and visibility; exceptions/overrides require a reason and authorised reviewer. Job status is a summary; a step history is not overwritten by moving backwards.

## Shared entry and states

Quote request → quote draft/revision → issued → accepted/rejected/expired → job opened (or staff opens a directly instructed job). Generate a collision-safe file number on opening. Job summary: `open`, `in_progress`, `on_hold`, `ready_to_close`, `closed`, `cancelled`; reopening a closed job requires a recorded reason and permission. Each job has exactly one primary service/direction/mode, but can contain multiple containers and related transport legs. Job number format and direct-job policy are [open decisions](decisions.md).

## Sea import

1. Receive shipping documents and register job; capture customer, consignee, shipping line, B/L and container(s).
2. Monitor arrival/ETA and send approved updates.
3. Record customs declaration/assessment and duties; prepare customer invoice including service charges and pass-through charges.
4. Staff record customer's external payment and port/terminal/other disbursements; record shipping-line container release.
5. Record terminal booking/charges, customs inspection, customs release and delivery authorisation.
6. Assign truck/driver, issue waybill and dispatch; obtain signed proof of delivery including damage/exception notes.
7. Record empty-container return and EIR/condition; reconcile documents, costs and outstanding receivables; close when applicable evidence is present or override is approved.

## Sea export

1. Quote, open job, record cargo/customer requirements and vessel booking.
2. Arrange container to customer; record loading/stuffing and return to port.
3. Record customs processing/release and terminal handling charges/disbursements.
4. Confirm vessel departure, issue shipping documents and final invoice/waybill as applicable; close with evidence.

## Air import and air export

- Air import: receive airway bill and other documents → monitor flight arrival → customs assessment and charges → customer billing/external payment record → clearance and airport/airline charges → release → delivery and signed proof → close.
- Air export: quote/book airline → receive goods → customs/airport processing and charges → airline acceptance/departure and airway bill → invoice → close.
- Air jobs do not require container-return EIR. Required air-specific forms and carrier-event data are [to confirm](decisions.md).

## Warehousing and standalone road transport

- Warehouse job: quote/rate → receive goods into a named location and stock ledger → issue inventory reports → authorised partial/full picks reduce balance atomically → invoice and close when obligations are settled. Record units, condition and handling discrepancies; no negative quantities.
- Road job: quote → dispatch with assigned vehicle/driver and waybill → milestone/destination update → signed delivery proof → invoice/payment record → close. Multiple legs and subcontractors remain explicit records if required.

## Cross-cutting rules

- External observations (carrier API/website) never silently undo a staff-confirmed event. Preserve source, observed-at and effective-at, and flag conflicts for review.
- Status updates marked `internal` do not become client-visible; `client_visible` requires an authorised publish step. Never send internal notes/costs to clients.
- Missing documents, damaged cargo, revised ETA, partial payment and failed delivery create exceptions/tasks, not a forced happy-path progression.
- Generated invoice/waybill/delivery note retains its issued version; corrections create a revision/credit or documented adjustment under approved business rules.
