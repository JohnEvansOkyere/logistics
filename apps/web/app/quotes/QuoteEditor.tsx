"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { quoteBasisKeys, quoteBasisLabels } from "@bjh/contracts";
import type { QuoteBasis, ServiceLine } from "@bjh/contracts";
import { useStaffAccess } from "../auth/useStaffAccess";
import { listCustomers } from "../customers/customerApi";
import type { CustomerCompany } from "../customers/customerApi";
import { serviceLineLabels } from "../jobs/jobApi";
import styles from "../jobs/jobs.module.css";
import { getSettings } from "../settings/business/settingsApi";
import { createQuote, saveQuoteDraft, toMinor } from "./quoteApi";
import type { Quote, QuoteVersion, QuoteVersionBody } from "./quoteApi";

const serviceLines = Object.keys(serviceLineLabels) as ServiceLine[];

type LineDraft = {
  section: string;
  description: string;
  basis: QuoteBasis;
  basisNote: string;
  sized: boolean;
  amount: string;
  amount20: string;
  amount40: string;
};

const blankLine = (section = ""): LineDraft => ({
  section,
  description: "",
  basis: "fixed",
  basisNote: "",
  sized: false,
  amount: "",
  amount20: "",
  amount40: "",
});

const major = (minor: number | null) =>
  minor === null ? "" : (minor / 100).toFixed(2);

const toLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function linesFrom(version?: QuoteVersion): LineDraft[] {
  if (!version || version.lines.length === 0) return [blankLine()];
  return version.lines.map((line) => ({
    section: line.section ?? "",
    description: line.description,
    basis: line.basis,
    basisNote: line.basisNote ?? "",
    sized: line.amount20ftMinor !== null,
    amount: major(line.amountMinor),
    amount20: major(line.amount20ftMinor),
    amount40: major(line.amount40ftMinor),
  }));
}

/** Prepares a new quote, or edits the draft version of an existing one. */
export function QuoteEditor({
  quote,
  draft,
  onSaved,
}: {
  quote?: Quote;
  draft?: QuoteVersion;
  onSaved?: (quote: Quote) => void;
}) {
  const router = useRouter();
  const { roles, isSuperAdmin } = useStaffAccess();
  const [customers, setCustomers] = useState<CustomerCompany[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [serviceLine, setServiceLine] = useState<ServiceLine | "">("");
  const [currency, setCurrency] = useState(draft?.currency ?? "USD");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [subtitle, setSubtitle] = useState(draft?.subtitle ?? "");
  const [shipmentScope, setShipmentScope] = useState(
    draft?.shipmentScope ?? "",
  );
  const [intro, setIntro] = useState(draft?.intro ?? "");
  const [atCostNote, setAtCostNote] = useState(draft?.atCostNote ?? "");
  const [steps, setSteps] = useState((draft?.procedureSteps ?? []).join("\n"));
  const [documents, setDocuments] = useState(
    (draft?.requiredDocuments ?? []).join("\n"),
  );
  const [documentsNote, setDocumentsNote] = useState(
    draft?.documentsNote ?? "",
  );
  const [timeline, setTimeline] = useState(draft?.timeline ?? "");
  const [terms, setTerms] = useState((draft?.terms ?? []).join("\n"));
  const [lines, setLines] = useState<LineDraft[]>(linesFrom(draft));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [configuredCurrencies, setConfiguredCurrencies] = useState<string[]>(
    [],
  );

  const allowedLines = isSuperAdmin
    ? serviceLines
    : serviceLines.filter((line) => roles.includes(`${line}_rep`));

  useEffect(() => {
    if (quote) return;
    listCustomers("")
      .then(setCustomers)
      .catch(() => setError("Customers could not be loaded"));
  }, [quote]);

  // Configured currencies and, for a new quote, the default text from Settings.
  useEffect(() => {
    getSettings()
      .then(({ current }) => {
        if (!current) return;
        const { settings } = current;
        setConfiguredCurrencies(settings.currencies);
        if (draft) return;
        setCurrency(settings.defaultCurrency);
        setIntro(settings.quoteDefaults.intro ?? "");
        setAtCostNote(settings.quoteDefaults.atCostNote ?? "");
        setSteps(settings.quoteDefaults.procedureSteps.join("\n"));
        setDocuments(settings.quoteDefaults.requiredDocuments.join("\n"));
        setDocumentsNote(settings.quoteDefaults.documentsNote ?? "");
        setTimeline(settings.quoteDefaults.timeline ?? "");
        setTerms(settings.quoteDefaults.terms.join("\n"));
      })
      .catch(() => undefined);
  }, [draft]);

  function change(index: number, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line, at) => (at === index ? { ...line, ...patch } : line)),
    );
  }

  function buildBody(): QuoteVersionBody | string {
    const built: QuoteVersionBody["lines"] = [];
    for (const line of lines) {
      const amounts = line.sized
        ? [toMinor(line.amount20), toMinor(line.amount40)]
        : [toMinor(line.amount)];
      if (amounts.some((value) => Number.isNaN(value))) {
        return "Amounts must be numbers such as 250 or 250.50";
      }
      built.push({
        section: line.section.trim() || undefined,
        description: line.description.trim(),
        basis: line.basis,
        basisNote: line.basisNote.trim() || undefined,
        ...(line.sized
          ? { amount20ftMinor: amounts[0], amount40ftMinor: amounts[1] }
          : { amountMinor: amounts[0] }),
      });
    }
    return {
      currency: currency.trim(),
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      shipmentScope: shipmentScope.trim() || undefined,
      intro: intro.trim() || undefined,
      atCostNote: atCostNote.trim() || undefined,
      procedureSteps: toLines(steps),
      requiredDocuments: toLines(documents),
      documentsNote: documentsNote.trim() || undefined,
      timeline: timeline.trim() || undefined,
      terms: toLines(terms),
      lines: built,
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const body = buildBody();
    if (typeof body === "string") {
      setError(body);
      return;
    }
    setSaving(true);
    try {
      if (quote) {
        onSaved?.(await saveQuoteDraft(quote.id, body));
      } else {
        const created = await createQuote({
          customerCompanyId: customerId,
          serviceLine: serviceLine as ServiceLine,
          version: body,
        });
        router.push(`/quotes/${created.id}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The quote failed");
    }
    setSaving(false);
  }

  return (
    <main className={quote ? undefined : styles.page}>
      {!quote && (
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>QUOTATIONS</p>
            <h1 className={styles.title}>Prepare a quote</h1>
            <p className={styles.muted}>
              The quote number is issued when the quote is first issued.
            </p>
          </div>
          <Link className={styles.secondaryButton} href="/quotes">
            Back to quotes
          </Link>
        </header>
      )}
      <form className={styles.card} onSubmit={(event) => void submit(event)}>
        <div className={styles.form}>
          {!quote && (
            <>
              <label className={styles.field}>
                Customer
                <select
                  onChange={(event) => setCustomerId(event.target.value)}
                  required
                  value={customerId}
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Service
                <select
                  onChange={(event) =>
                    setServiceLine(event.target.value as ServiceLine)
                  }
                  required
                  value={serviceLine}
                >
                  <option value="">Select a service</option>
                  {allowedLines.map((line) => (
                    <option key={line} value={line}>
                      {serviceLineLabels[line]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className={styles.field}>
            Title
            <input
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
          <label className={styles.field}>
            Subtitle (optional)
            <input
              onChange={(event) => setSubtitle(event.target.value)}
              value={subtitle}
            />
          </label>
          {configuredCurrencies.length > 0 ? (
            <label className={styles.field}>
              Currency
              <select
                onChange={(event) => setCurrency(event.target.value)}
                value={currency}
              >
                {configuredCurrencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className={styles.field}>
              Currency (3-letter code, for example USD or GHS)
              <input
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value)}
                required
                value={currency}
              />
            </label>
          )}
          <label className={styles.field}>
            Shipment (optional, for example 20ft FCL / 40ft FCL)
            <input
              onChange={(event) => setShipmentScope(event.target.value)}
              value={shipmentScope}
            />
          </label>
          <label className={styles.field}>
            Introduction (optional)
            <textarea
              onChange={(event) => setIntro(event.target.value)}
              rows={3}
              value={intro}
            />
          </label>

          <h2>Charges</h2>
          {lines.map((line, index) => (
            <fieldset className={styles.card} key={index}>
              <legend>Charge {index + 1}</legend>
              <label className={styles.field}>
                Table heading (charges with the same heading are grouped)
                <input
                  onChange={(event) =>
                    change(index, { section: event.target.value })
                  }
                  value={line.section}
                />
              </label>
              <label className={styles.field}>
                Charge
                <input
                  onChange={(event) =>
                    change(index, { description: event.target.value })
                  }
                  required
                  value={line.description}
                />
              </label>
              <label className={styles.field}>
                Basis
                <select
                  onChange={(event) =>
                    change(index, { basis: event.target.value as QuoteBasis })
                  }
                  value={line.basis}
                >
                  {quoteBasisKeys.map((basis) => (
                    <option key={basis} value={basis}>
                      {quoteBasisLabels[basis]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Basis note (optional, for example Based on HS code and CIF
                value)
                <input
                  onChange={(event) =>
                    change(index, { basisNote: event.target.value })
                  }
                  value={line.basisNote}
                />
              </label>
              <label>
                <input
                  checked={line.sized}
                  onChange={(event) =>
                    change(index, { sized: event.target.checked })
                  }
                  type="checkbox"
                />{" "}
                Priced by container size (20ft and 40ft)
              </label>
              {line.sized ? (
                <>
                  <label className={styles.field}>
                    20ft amount
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        change(index, { amount20: event.target.value })
                      }
                      value={line.amount20}
                    />
                  </label>
                  <label className={styles.field}>
                    40ft amount
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        change(index, { amount40: event.target.value })
                      }
                      value={line.amount40}
                    />
                  </label>
                </>
              ) : (
                <label className={styles.field}>
                  Amount (leave empty only for at-cost charges)
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      change(index, { amount: event.target.value })
                    }
                    value={line.amount}
                  />
                </label>
              )}
              <div className={styles.actions}>
                <button
                  className={styles.secondaryButton}
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((_, at) => at !== index),
                    )
                  }
                  type="button"
                >
                  Remove charge
                </button>
              </div>
            </fieldset>
          ))}
          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              onClick={() =>
                setLines((current) => [
                  ...current,
                  blankLine(current[current.length - 1]?.section ?? ""),
                ])
              }
              type="button"
            >
              Add a charge
            </button>
          </div>

          <label className={styles.field}>
            Note on at-cost charges (optional)
            <textarea
              onChange={(event) => setAtCostNote(event.target.value)}
              rows={2}
              value={atCostNote}
            />
          </label>
          <label className={styles.field}>
            Clearance procedure (one step per line)
            <textarea
              onChange={(event) => setSteps(event.target.value)}
              rows={5}
              value={steps}
            />
          </label>
          <label className={styles.field}>
            Documents required (one per line)
            <textarea
              onChange={(event) => setDocuments(event.target.value)}
              rows={3}
              value={documents}
            />
          </label>
          <label className={styles.field}>
            Note on documents (optional)
            <textarea
              onChange={(event) => setDocumentsNote(event.target.value)}
              rows={2}
              value={documentsNote}
            />
          </label>
          <label className={styles.field}>
            Timeline (optional)
            <textarea
              onChange={(event) => setTimeline(event.target.value)}
              rows={2}
              value={timeline}
            />
          </label>
          <label className={styles.field}>
            Important terms (one per line)
            <textarea
              onChange={(event) => setTerms(event.target.value)}
              rows={5}
              value={terms}
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button className={styles.button} disabled={saving} type="submit">
              {saving ? "Saving…" : quote ? "Save draft" : "Save as draft"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
