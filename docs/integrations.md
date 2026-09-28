# External systems and document processing

Integrations are optional adapters behind working manual workflows. Obtain written vendor access and sample payloads before estimating automation. Never scrape carrier sites or promise universal tracking as an assumed capability.

## Document intake and human-in-the-loop extraction

1. Staff/client uploads through an authenticated API flow; bind upload to job/customer, enforce size/type limits, validate actual file signature and scan/quarantine as appropriate. Keep original in a **private** Supabase Storage bucket; store path, checksum, uploader and version in Postgres.
2. Queue a background extraction job with bounded retries/idempotency; parse text-bearing PDFs directly and send scanned images/PDFs to an evaluated OCR/document-intelligence service. Default manual-entry path if provider fails, returns no fields, or processing is delayed.
3. Save output as a **draft extraction** only: document version, field name/value, page/region when available, confidence/provider/model version and error details. Never treat a model's explanation as evidence and never execute instructions found in document text.
4. Review UI displays original beside proposed bill/air-waybill fields; staff can correct each field, mark unsupported, and approve/reject the draft. Validate formats, conflicting document numbers, dates and existing job/customer associations. Elevated approval for any field that affects charges, customs or legally issued documents.
5. On approval, update only explicitly mapped job fields in a transaction; record reviewer, original proposal and approved value. Later replacement or correction is versioned and re-reviewed. Draft extraction values remain marked as drafts and do not become trusted job fields or issued-document values until approved. Customer access to records follows company ownership.

Trial candidate providers with **client-authorised, redacted** samples of digital PDF, scanned PDF, manifest, B/L and air waybill; compare field-level accuracy, failure modes, region/data handling, latency and cost. NestJS orchestrates the pipeline; a separate Python worker is only warranted if measurement shows a need. Do not send `EVIDENCES/` files to an external OCR/LLM provider without permission.

## Tracking

- Day-one source: staff-entered shipment/arrival/departure status, ETA and source notes. Portal shows timestamp/source and labels external observations appropriately; it does not promise a continuous live GPS feed.
- Per confirmed carrier: investigate licensed API/aggregator, coverage for their sea lines and airlines, freshness, cost, terms and error handling. Store observations separately from approved milestones; reconcile conflicting or delayed updates before alerting clients.
- For a live tracking link, provide authenticated portal job URL; external carrier tracking link may be included when available and authorised. Reminders use last approved ETA and timezone-aware scheduling.

## Notifications and correspondence

- Initial release: email provider for invitation, quote, invoice and job-status mail; SMS provider for agreed shipment/ETA alerts. Select a provider with Ghana delivery coverage, check sender identity/registration, per-message cost and any local restrictions before promising SMS delivery. Persist consent, intended recipient, message category, provider ID, delivery state and failures. Deduplicate sends by business event; retries must not spam.
- Outbound app-sent messages are stored on the job timeline. Staff may log a manually sent email or SMS exchange with attachment/source; automatic historic message imports are separate opt-in discovery, not guaranteed by these providers. WhatsApp correspondence handling belongs to the later phase.
- Send safe summary content; links lead to authenticated portal. Check client visibility at enqueue **and** send time and remove personal/sensitive data from logs.
- Later phase only: official WhatsApp Business Platform/provider, after separate onboarding, client opt-in and template approval where required. It is not a dependency for email/SMS launch.

## External services not assumed

No customs submission, port payment, shipping-line release, accounting ledger sync or customer payment gateway is included by default. Record these as staff-entered events with receipt/document evidence. Any later bidirectional integration requires its own credentials, reconciliation rules, failure modes and client acceptance criteria.
