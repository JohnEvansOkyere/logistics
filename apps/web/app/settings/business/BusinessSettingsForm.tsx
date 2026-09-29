"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useStaffAccess } from "../../auth/useStaffAccess";
import styles from "../../jobs/jobs.module.css";
import {
  getSettings,
  listSettingsRevisions,
  saveSettings,
} from "./settingsApi";
import type { SettingsRevision } from "./settingsApi";

type TaxRow = { name: string; rate: string };

const toLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** "15" or "7.5" percent -> basis points; anything else -> NaN. */
const toBasisPoints = (rate: string) =>
  /^\d+(\.\d{1,2})?$/.test(rate.trim())
    ? Math.round(Number(rate.trim()) * 100)
    : Number.NaN;

export function BusinessSettingsForm() {
  const { isSuperAdmin } = useStaffAccess();
  const [revision, setRevision] = useState<SettingsRevision | null>(null);
  const [history, setHistory] = useState<SettingsRevision[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [currencies, setCurrencies] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("");
  const [taxes, setTaxes] = useState<TaxRow[]>([]);
  const [terms, setTerms] = useState("");
  const [quotePrefix, setQuotePrefix] = useState("BJH/Q");
  const [invoicePrefix, setInvoicePrefix] = useState("BJH/INV");
  const [receiptPrefix, setReceiptPrefix] = useState("BJH/RCT");
  const [intro, setIntro] = useState("");
  const [atCostNote, setAtCostNote] = useState("");
  const [steps, setSteps] = useState("");
  const [documents, setDocuments] = useState("");
  const [documentsNote, setDocumentsNote] = useState("");
  const [timeline, setTimeline] = useState("");
  const [quoteTerms, setQuoteTerms] = useState("");

  const fill = useCallback((current: SettingsRevision | null) => {
    setRevision(current);
    if (!current) return;
    const { settings } = current;
    setName(settings.issuer.name);
    setAddress(settings.issuer.address ?? "");
    setPhone(settings.issuer.phone ?? "");
    setEmail(settings.issuer.email ?? "");
    setWebsite(settings.issuer.website ?? "");
    setCurrencies(settings.currencies.join(", "));
    setDefaultCurrency(settings.defaultCurrency);
    setTaxes(
      settings.taxLines.map((line) => ({
        name: line.name,
        rate: String(line.rateBasisPoints / 100),
      })),
    );
    setTerms(
      settings.paymentTermsDays === null
        ? ""
        : String(settings.paymentTermsDays),
    );
    setQuotePrefix(settings.numbering.quotePrefix);
    setInvoicePrefix(settings.numbering.invoicePrefix);
    setReceiptPrefix(settings.numbering.receiptPrefix);
    setIntro(settings.quoteDefaults.intro ?? "");
    setAtCostNote(settings.quoteDefaults.atCostNote ?? "");
    setSteps(settings.quoteDefaults.procedureSteps.join("\n"));
    setDocuments(settings.quoteDefaults.requiredDocuments.join("\n"));
    setDocumentsNote(settings.quoteDefaults.documentsNote ?? "");
    setTimeline(settings.quoteDefaults.timeline ?? "");
    setQuoteTerms(settings.quoteDefaults.terms.join("\n"));
  }, []);

  const load = useCallback(async () => {
    try {
      fill((await getSettings()).current);
      setLoaded(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Settings could not be loaded",
      );
    }
  }, [fill]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    listSettingsRevisions()
      .then(setHistory)
      .catch(() => undefined);
  }, [isSuperAdmin, revision]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const rates = taxes.map((row) => toBasisPoints(row.rate));
    if (rates.some((rate) => Number.isNaN(rate))) {
      setError("Tax rates must be percentages such as 15 or 2.5");
      return;
    }
    try {
      const saved = await saveSettings({
        issuer: {
          name,
          address,
          phone,
          email,
          website,
        },
        currencies: currencies
          .split(/[\s,]+/)
          .map((code) => code.trim())
          .filter(Boolean),
        defaultCurrency,
        taxLines: taxes.map((row, index) => ({
          name: row.name,
          rateBasisPoints: rates[index],
        })),
        paymentTermsDays: terms.trim() === "" ? null : Number(terms),
        numbering: { quotePrefix, invoicePrefix, receiptPrefix },
        quoteDefaults: {
          intro,
          atCostNote,
          procedureSteps: toLines(steps),
          requiredDocuments: toLines(documents),
          documentsNote,
          timeline,
          terms: toLines(quoteTerms),
        },
      });
      fill(saved);
      setNotice(`Saved as revision ${saved.revisionNumber}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The save failed");
    }
  }

  const text = (
    label: string,
    value: string,
    set: (value: string) => void,
    required = false,
  ) => (
    <label className={styles.field}>
      {label}
      <input
        onChange={(event) => set(event.target.value)}
        required={required}
        value={value}
      />
    </label>
  );
  const area = (
    label: string,
    value: string,
    set: (value: string) => void,
    rows = 3,
  ) => (
    <label className={styles.field}>
      {label}
      <textarea
        onChange={(event) => set(event.target.value)}
        rows={rows}
        value={value}
      />
    </label>
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SETTINGS</p>
          <h1 className={styles.title}>Business settings</h1>
          <p className={styles.muted}>
            {revision
              ? `Revision ${revision.revisionNumber}. Every save keeps the earlier revisions.`
              : "Not configured yet."}{" "}
            {!isSuperAdmin && "Only the super admin can change these."}
          </p>
        </div>
        <Link className={styles.secondaryButton} href="/settings">
          Back to settings
        </Link>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && <p className={styles.notice}>{notice}</p>}
      {!loaded && !error && <p role="status">Loading settings…</p>}

      {loaded && (
        <form className={styles.card} onSubmit={(event) => void submit(event)}>
          <fieldset
            className={styles.form}
            disabled={!isSuperAdmin}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <h2>Issuer</h2>
            {text("Company name", name, setName, true)}
            {area("Address", address, setAddress, 2)}
            {text("Phone", phone, setPhone)}
            {text("Email", email, setEmail)}
            {text("Website", website, setWebsite)}

            <h2>Currencies</h2>
            {text(
              "Currencies (3-letter codes, separated by commas)",
              currencies,
              setCurrencies,
              true,
            )}
            {text(
              "Default currency",
              defaultCurrency,
              setDefaultCurrency,
              true,
            )}
            {text("Payment terms in days (optional)", terms, setTerms)}

            <h2>Tax lines</h2>
            {taxes.map((row, index) => (
              <div className={styles.card} key={index}>
                {text(
                  `Tax ${index + 1} name (for example VAT)`,
                  row.name,
                  (value) =>
                    setTaxes((current) =>
                      current.map((item, at) =>
                        at === index ? { ...item, name: value } : item,
                      ),
                    ),
                )}
                {text("Rate in percent", row.rate, (value) =>
                  setTaxes((current) =>
                    current.map((item, at) =>
                      at === index ? { ...item, rate: value } : item,
                    ),
                  ),
                )}
                <button
                  className={styles.secondaryButton}
                  onClick={() =>
                    setTaxes((current) =>
                      current.filter((_, at) => at !== index),
                    )
                  }
                  type="button"
                >
                  Remove tax line
                </button>
              </div>
            ))}
            <div className={styles.actions}>
              <button
                className={styles.secondaryButton}
                onClick={() =>
                  setTaxes((current) => [...current, { name: "", rate: "" }])
                }
                type="button"
              >
                Add a tax line
              </button>
            </div>

            <h2>Numbering prefixes</h2>
            {text("Quote prefix", quotePrefix, setQuotePrefix, true)}
            {text("Invoice prefix", invoicePrefix, setInvoicePrefix, true)}
            {text("Receipt prefix", receiptPrefix, setReceiptPrefix, true)}

            <h2>Quote defaults</h2>
            <p className={styles.muted}>
              New quotes start with this text. Staff can change it per quote.
            </p>
            {area("Introduction", intro, setIntro)}
            {area("Note on at-cost charges", atCostNote, setAtCostNote, 2)}
            {area(
              "Clearance procedure (one step per line)",
              steps,
              setSteps,
              5,
            )}
            {area("Documents required (one per line)", documents, setDocuments)}
            {area("Note on documents", documentsNote, setDocumentsNote, 2)}
            {area("Timeline", timeline, setTimeline, 2)}
            {area(
              "Important terms (one per line)",
              quoteTerms,
              setQuoteTerms,
              5,
            )}

            {isSuperAdmin && (
              <div className={styles.actions}>
                <button className={styles.button} type="submit">
                  Save settings
                </button>
              </div>
            )}
          </fieldset>
        </form>
      )}

      {isSuperAdmin && history.length > 0 && (
        <section className={styles.card} aria-labelledby="revisions-title">
          <h2 id="revisions-title">Revision history</h2>
          <ul className={styles.list}>
            {history.map((item) => (
              <li key={item.revisionNumber}>
                Revision {item.revisionNumber} ·{" "}
                {new Date(item.changedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
