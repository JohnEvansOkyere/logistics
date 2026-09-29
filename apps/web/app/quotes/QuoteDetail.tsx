"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { quoteBasisLabels } from "@bjh/contracts";
import { useStaffAccess } from "../auth/useStaffAccess";
import { serviceLineLabels } from "../jobs/jobApi";
import styles from "../jobs/jobs.module.css";
import { QuoteEditor } from "./QuoteEditor";
import {
  fetchQuotePdf,
  formatMoney,
  getQuote,
  issueQuote,
  recordQuoteDecision,
  startQuoteVersion,
} from "./quoteApi";
import type { Quote, QuoteLine, QuoteVersion } from "./quoteApi";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function amountText(line: QuoteLine, minor: number | null, currency: string) {
  if (minor === null) return line.basis === "at_cost" ? "At cost" : "—";
  const money = formatMoney(minor, currency);
  return line.basis === "at_cost" ? `At cost · ${money}` : money;
}

/** One version laid out like the printed quotation: tables grouped by heading. */
function VersionView({ version }: { version: QuoteVersion }) {
  const sections: Array<{ heading: string; lines: QuoteLine[] }> = [];
  for (const line of version.lines) {
    const heading = line.section ?? "Charges";
    const current = sections[sections.length - 1];
    if (current && current.heading === heading) current.lines.push(line);
    else sections.push({ heading, lines: [line] });
  }
  return (
    <div>
      <h3>{version.title}</h3>
      {version.subtitle && <p className={styles.muted}>{version.subtitle}</p>}
      {version.shipmentScope && <p>Shipment: {version.shipmentScope}</p>}
      {version.intro && <p>{version.intro}</p>}
      {sections.map((section) => {
        const sized = section.lines.some(
          (line) => line.amount20ftMinor !== null,
        );
        return (
          <div className={styles.tableScroll} key={section.heading}>
            <table className={styles.table}>
              <caption>{section.heading}</caption>
              <thead>
                <tr>
                  <th scope="col">Charge</th>
                  {sized ? (
                    <>
                      <th scope="col">20ft</th>
                      <th scope="col">40ft</th>
                    </>
                  ) : (
                    <th scope="col">Amount</th>
                  )}
                  <th scope="col">Basis</th>
                </tr>
              </thead>
              <tbody>
                {section.lines.map((line) => (
                  <tr key={line.id}>
                    <th scope="row">{line.description}</th>
                    {sized ? (
                      <>
                        <td>
                          {amountText(
                            line,
                            line.amount20ftMinor,
                            version.currency,
                          )}
                        </td>
                        <td>
                          {amountText(
                            line,
                            line.amount40ftMinor,
                            version.currency,
                          )}
                        </td>
                      </>
                    ) : (
                      <td>
                        {amountText(line, line.amountMinor, version.currency)}
                      </td>
                    )}
                    <td>
                      {line.basis === "at_cost" && line.basisNote
                        ? line.basisNote
                        : `${quoteBasisLabels[line.basis]}${
                            line.basisNote ? ` · ${line.basisNote}` : ""
                          }`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className={styles.muted}>
        All amounts are in {version.currency} unless otherwise stated.
      </p>
      {version.atCostNote && <p>{version.atCostNote}</p>}
      {version.procedureSteps.length > 0 && (
        <>
          <h4>Procedure</h4>
          <ol className={styles.list}>
            {version.procedureSteps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </>
      )}
      {version.requiredDocuments.length > 0 && (
        <>
          <h4>Documents required</h4>
          <ul className={styles.list}>
            {version.requiredDocuments.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          {version.documentsNote && <p>{version.documentsNote}</p>}
        </>
      )}
      {version.timeline && (
        <>
          <h4>Timeline</h4>
          <p>{version.timeline}</p>
        </>
      )}
      {version.terms.length > 0 && (
        <>
          <h4>Important terms</h4>
          <ul className={styles.list}>
            {version.terms.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function QuoteDetail({ quoteId }: { quoteId: string }) {
  const { roles } = useStaffAccess();
  const isStaff = roles.length > 0;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [decision, setDecision] = useState<"accepted" | "rejected">("accepted");
  const [signatory, setSignatory] = useState("");
  const [decidedAt, setDecidedAt] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [openedJob, setOpenedJob] = useState<{
    id: string;
    fileNumber: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setQuote(await getQuote(quoteId));
      setLoadError("");
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "The quote could not be loaded",
      );
    }
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<Quote>) {
    setError("");
    try {
      setQuote(await action());
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  }

  async function openPdf(versionNumber: number) {
    // Opened first so the browser treats it as a click, not a pop-up.
    const tab = window.open("", "_blank");
    setError("");
    try {
      const blob = await fetchQuotePdf(quoteId, versionNumber);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (cause) {
      tab?.close();
      setError(cause instanceof Error ? cause.message : "The PDF failed");
    }
  }

  async function submitDecision(event: FormEvent) {
    event.preventDefault();
    if (!quote) return;
    const latest = quote.versions
      .filter((version) => version.status === "issued")
      .at(-1);
    if (!latest) return;
    setError("");
    try {
      const result = await recordQuoteDecision(quote.id, {
        versionNumber: latest.versionNumber,
        decision,
        clientSignatory: signatory.trim(),
        decidedAt: decidedAt ? new Date(decidedAt).toISOString() : undefined,
        note: decisionNote.trim() || undefined,
      });
      setOpenedJob(result.job);
      setSignatory("");
      setDecidedAt("");
      setDecisionNote("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  }

  if (loadError) {
    return (
      <main className={styles.page}>
        <Link className={styles.link} href="/quotes">
          ← Quotes
        </Link>
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      </main>
    );
  }
  if (!quote) {
    return (
      <main className={styles.page}>
        <p role="status">Loading quote…</p>
      </main>
    );
  }

  const draft = quote.versions.find((version) => version.status === "draft");
  const issued = quote.versions.filter(
    (version) => version.status === "issued",
  );
  const accepted = quote.decisions.some((item) => item.decision === "accepted");
  const latestIssued = issued.at(-1);
  const latestDecided =
    latestIssued !== undefined &&
    quote.decisions.some(
      (item) => item.versionNumber === latestIssued.versionNumber,
    );

  return (
    <main className={styles.page}>
      <Link className={styles.link} href="/quotes">
        ← Quotes
      </Link>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {serviceLineLabels[quote.serviceLine].toUpperCase()}
          </p>
          <h1 className={styles.title}>
            {quote.quoteNumber ?? "Draft (not numbered)"}
          </h1>
          <p className={styles.muted}>
            {quote.customerCompanyName} · prepared {formatDate(quote.createdAt)}
          </p>
        </div>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {quote.jobId && (
        <p className={styles.notice}>
          This quote was accepted.{" "}
          <Link className={styles.link} href={`/jobs/${quote.jobId}`}>
            Open the job
            {openedJob ? ` ${openedJob.fileNumber}` : ""}
          </Link>
        </p>
      )}

      {isStaff && !accepted && (
        <section className={styles.card} aria-labelledby="quote-actions">
          <h2 id="quote-actions">Actions</h2>
          <div className={styles.actions}>
            {draft && (
              <>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setEditing((value) => !value)}
                  type="button"
                >
                  {editing ? "Cancel editing" : "Edit draft"}
                </button>
                <button
                  className={styles.button}
                  onClick={() => void run(() => issueQuote(quote.id))}
                  type="button"
                >
                  Issue to customer
                </button>
              </>
            )}
            {!draft && !accepted && (
              <button
                className={styles.secondaryButton}
                onClick={() => void run(() => startQuoteVersion(quote.id))}
                type="button"
              >
                Start a new version
              </button>
            )}
          </div>
          <p className={styles.muted}>
            Issuing makes the version visible to the customer and locks it. A
            later change is a new version.
          </p>
        </section>
      )}

      {isStaff && latestIssued && !latestDecided && (
        <section className={styles.card} aria-labelledby="decision-title">
          <h2 id="decision-title">
            Record the client&apos;s decision on version{" "}
            {latestIssued.versionNumber}
          </h2>
          <form
            className={styles.form}
            onSubmit={(event) => void submitDecision(event)}
          >
            <label className={styles.field}>
              Decision
              <select
                onChange={(event) =>
                  setDecision(event.target.value as "accepted" | "rejected")
                }
                value={decision}
              >
                <option value="accepted">Accepted (opens the job)</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className={styles.field}>
              Client signatory (name of the person who decided)
              <input
                onChange={(event) => setSignatory(event.target.value)}
                required
                value={signatory}
              />
            </label>
            <label className={styles.field}>
              When they decided (optional, defaults to now)
              <input
                onChange={(event) => setDecidedAt(event.target.value)}
                type="datetime-local"
                value={decidedAt}
              />
            </label>
            <label className={styles.field}>
              Note (optional)
              <input
                onChange={(event) => setDecisionNote(event.target.value)}
                value={decisionNote}
              />
            </label>
            <button className={styles.button} type="submit">
              Record decision
            </button>
          </form>
        </section>
      )}

      {quote.decisions.length > 0 && (
        <section className={styles.card} aria-labelledby="decisions-title">
          <h2 id="decisions-title">Decisions</h2>
          <ul className={styles.list}>
            {quote.decisions.map((item) => (
              <li key={item.id}>
                Version {item.versionNumber} ·{" "}
                {item.decision === "accepted" ? "Accepted" : "Rejected"} by{" "}
                {item.clientSignatory} · {formatDate(item.decidedAt)}
                {item.note ? ` — ${item.note}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && draft && (
        <QuoteEditor
          draft={draft}
          onSaved={(saved) => {
            setQuote(saved);
            setEditing(false);
          }}
          quote={quote}
        />
      )}

      {draft && !editing && isStaff && (
        <section className={styles.card} aria-labelledby="draft-title">
          <h2 id="draft-title">Draft · version {draft.versionNumber}</h2>
          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              onClick={() => void openPdf(draft.versionNumber)}
              type="button"
            >
              Download PDF (marked draft)
            </button>
          </div>
          <VersionView version={draft} />
        </section>
      )}

      {[...issued].reverse().map((version) => (
        <section
          aria-labelledby={`version-${version.versionNumber}`}
          className={styles.card}
          key={version.id}
        >
          <h2 id={`version-${version.versionNumber}`}>
            Version {version.versionNumber} · issued{" "}
            {version.issuedAt ? formatDate(version.issuedAt) : ""}
          </h2>
          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              onClick={() => void openPdf(version.versionNumber)}
              type="button"
            >
              Download PDF
            </button>
          </div>
          <VersionView version={version} />
        </section>
      ))}
    </main>
  );
}
