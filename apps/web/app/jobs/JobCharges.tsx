"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { chargeKindLabels } from "@bjh/contracts";
import type { ChargeKind } from "@bjh/contracts";
import { formatMoney, toMinor } from "../quotes/quoteApi";
import {
  addCharge,
  importCharges,
  listCharges,
  recordActual,
  removeCharge,
} from "./jobApi";
import type { ChargeTotals, JobCharge, JobDocument } from "./jobApi";
import styles from "./jobs.module.css";

const evidenceTypes = ["supplier_invoice", "disbursement_evidence"];

const signed = (minor: number, currency: string) =>
  `${minor > 0 ? "+" : ""}${formatMoney(minor, currency)}`;

/** Job costing: what was quoted vs what it cost, with supplier evidence. */
export function JobCharges({
  jobId,
  quoteId,
  documents,
  canEdit,
}: {
  jobId: string;
  quoteId: string | null;
  documents: JobDocument[];
  canEdit: boolean;
}) {
  const [charges, setCharges] = useState<JobCharge[] | null>(null);
  const [totals, setTotals] = useState<ChargeTotals[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<ChargeKind>("service");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [quoted, setQuoted] = useState("");
  const [size, setSize] = useState<"" | "20ft" | "40ft">("");
  const [recording, setRecording] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [actualCurrency, setActualCurrency] = useState("");
  const [rate, setRate] = useState("");
  const [rateNote, setRateNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await listCharges(jobId);
      setCharges(result.charges);
      setTotals(result.totals);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Charges could not be loaded",
      );
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setError("");
    setNotice("");
    try {
      await action();
      after?.();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  }

  function submitCharge(event: FormEvent) {
    event.preventDefault();
    const unit = toMinor(quoted);
    if (Number.isNaN(unit)) {
      setError("Amounts must be numbers such as 250 or 250.50");
      return;
    }
    void run(
      () =>
        addCharge(jobId, {
          kind,
          description: description.trim(),
          currency: currency.trim(),
          quantity: Number(quantity) || 1,
          unitQuotedMinor: unit,
        }),
      () => {
        setDescription("");
        setQuoted("");
        setQuantity("1");
      },
    );
  }

  function submitActual(event: FormEvent, charge: JobCharge) {
    event.preventDefault();
    const minor = toMinor(amount);
    if (minor === undefined || Number.isNaN(minor)) {
      setError("Enter the amount as a number such as 250 or 250.50");
      return;
    }
    const code = (actualCurrency || charge.currency).trim();
    void run(
      () =>
        recordActual(jobId, charge.id, {
          amountMinor: minor,
          currency: code,
          exchangeRate:
            code.toUpperCase() === charge.currency ? undefined : rate.trim(),
          rateNote: rateNote.trim() || undefined,
          supplierDocumentId: evidence || undefined,
          note: note.trim() || undefined,
          correctionOf: charge.currentActual?.id,
        }),
      () => {
        setRecording(null);
        setAmount("");
        setActualCurrency("");
        setRate("");
        setRateNote("");
        setEvidence("");
        setNote("");
      },
    );
  }

  const evidenceDocs = documents.filter((item) =>
    evidenceTypes.includes(item.documentType),
  );
  const evidenceName = (id: string | null) =>
    id
      ? (documents.find((item) => item.id === id)?.versions.at(-1)?.filename ??
        "document")
      : null;

  return (
    <section className={styles.card} aria-labelledby="charges-title">
      <h2 id="charges-title">Charges and costs</h2>
      <p className={styles.muted}>
        Internal costing: what was quoted against what it cost. Customers do not
        see this.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && <p className={styles.notice}>{notice}</p>}

      {totals.map((item) => (
        <p key={item.currency}>
          <strong>{item.currency}</strong> · quoted{" "}
          {formatMoney(item.quotedMinor, item.currency)} · actual{" "}
          {formatMoney(item.actualMinor, item.currency)} · difference{" "}
          {signed(item.actualMinor - item.quotedMinor, item.currency)}
          {item.chargesWithoutActual > 0 &&
            ` · ${item.chargesWithoutActual} without an actual amount`}
          {item.disbursementsWithoutEvidence > 0 &&
            ` · ${item.disbursementsWithoutEvidence} disbursement(s) without a supplier document`}
        </p>
      ))}

      {charges && charges.length === 0 && (
        <p className={styles.muted}>No charges yet.</p>
      )}
      {charges && charges.length > 0 && (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Charge</th>
                <th scope="col">Quoted</th>
                <th scope="col">Actual</th>
                <th scope="col">Difference</th>
                <th scope="col">Evidence</th>
                {canEdit && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr key={charge.id}>
                  <th scope="row">
                    {charge.description}
                    <br />
                    <span className={styles.muted}>
                      {chargeKindLabels[charge.kind]}
                      {charge.quantity > 1 ? ` · × ${charge.quantity}` : ""}
                    </span>
                  </th>
                  <td>
                    {charge.quotedTotalMinor === null
                      ? "At cost"
                      : formatMoney(charge.quotedTotalMinor, charge.currency)}
                  </td>
                  <td>
                    {charge.currentActual ? (
                      <>
                        {formatMoney(
                          charge.currentActual.convertedMinor,
                          charge.currency,
                        )}
                        {charge.currentActual.currency !== charge.currency && (
                          <>
                            <br />
                            <span className={styles.muted}>
                              {formatMoney(
                                charge.currentActual.amountMinor,
                                charge.currentActual.currency,
                              )}{" "}
                              at {charge.currentActual.exchangeRate}
                            </span>
                          </>
                        )}
                        {charge.actuals.length > 1 && (
                          <>
                            <br />
                            <span className={styles.muted}>
                              {charge.actuals.length} entries
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      "Not recorded"
                    )}
                  </td>
                  <td>
                    {charge.varianceMinor === null
                      ? "-"
                      : signed(charge.varianceMinor, charge.currency)}
                  </td>
                  <td>
                    {charge.kind === "service"
                      ? "-"
                      : charge.currentActual === null
                        ? "Awaiting amount"
                        : (evidenceName(
                            charge.currentActual.supplierDocumentId,
                          ) ?? "Missing")}
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        className={styles.secondaryButton}
                        onClick={() =>
                          setRecording(
                            recording === charge.id ? null : charge.id,
                          )
                        }
                        type="button"
                      >
                        {charge.currentActual
                          ? "Correct amount"
                          : "Record amount"}
                      </button>{" "}
                      {charge.actuals.length === 0 && (
                        <button
                          className={styles.secondaryButton}
                          onClick={() =>
                            void run(() => removeCharge(jobId, charge.id))
                          }
                          type="button"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit &&
        charges
          ?.filter((charge) => charge.id === recording)
          .map((charge) => (
            <form
              className={styles.form}
              key={charge.id}
              onSubmit={(event) => submitActual(event, charge)}
            >
              <h2>
                {charge.currentActual ? "Correct" : "Record"} the amount for{" "}
                {charge.description}
              </h2>
              <label className={styles.field}>
                Amount
                <input
                  inputMode="decimal"
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  value={amount}
                />
              </label>
              <label className={styles.field}>
                Currency of the amount (charge is in {charge.currency})
                <input
                  maxLength={3}
                  onChange={(event) => setActualCurrency(event.target.value)}
                  placeholder={charge.currency}
                  value={actualCurrency}
                />
              </label>
              {actualCurrency.trim() !== "" &&
                actualCurrency.trim().toUpperCase() !== charge.currency && (
                  <>
                    <label className={styles.field}>
                      Exchange rate (1 {actualCurrency.trim().toUpperCase()} in{" "}
                      {charge.currency})
                      <input
                        inputMode="decimal"
                        onChange={(event) => setRate(event.target.value)}
                        required
                        value={rate}
                      />
                    </label>
                    <label className={styles.field}>
                      Where the rate came from (optional)
                      <input
                        onChange={(event) => setRateNote(event.target.value)}
                        value={rateNote}
                      />
                    </label>
                  </>
                )}
              <label className={styles.field}>
                Supplier document (optional)
                <select
                  onChange={(event) => setEvidence(event.target.value)}
                  value={evidence}
                >
                  <option value="">None</option>
                  {evidenceDocs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.versions.at(-1)?.filename ?? item.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Note (optional)
                <input
                  onChange={(event) => setNote(event.target.value)}
                  value={note}
                />
              </label>
              <button className={styles.button} type="submit">
                Save amount
              </button>
            </form>
          ))}

      {canEdit && (
        <>
          <form className={styles.form} onSubmit={submitCharge}>
            <h2>Add a charge</h2>
            <label className={styles.field}>
              Type
              <select
                onChange={(event) => setKind(event.target.value as ChargeKind)}
                value={kind}
              >
                {(Object.keys(chargeKindLabels) as ChargeKind[]).map((item) => (
                  <option key={item} value={item}>
                    {chargeKindLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Description
              <input
                onChange={(event) => setDescription(event.target.value)}
                required
                value={description}
              />
            </label>
            <label className={styles.field}>
              Currency (3-letter code)
              <input
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value)}
                required
                value={currency}
              />
            </label>
            <label className={styles.field}>
              Quantity
              <input
                inputMode="numeric"
                onChange={(event) => setQuantity(event.target.value)}
                value={quantity}
              />
            </label>
            <label className={styles.field}>
              Quoted amount each (leave empty for at cost)
              <input
                inputMode="decimal"
                onChange={(event) => setQuoted(event.target.value)}
                value={quoted}
              />
            </label>
            <button className={styles.button} type="submit">
              Add charge
            </button>
          </form>

          {quoteId && (
            <div className={styles.form}>
              <h2>Copy charges from the accepted quote</h2>
              <label className={styles.field}>
                Container size (needed when the quote prices by size)
                <select
                  onChange={(event) =>
                    setSize(event.target.value as "" | "20ft" | "40ft")
                  }
                  value={size}
                >
                  <option value="">Not applicable</option>
                  <option value="20ft">20ft</option>
                  <option value="40ft">40ft</option>
                </select>
              </label>
              <div className={styles.actions}>
                <button
                  className={styles.secondaryButton}
                  onClick={() =>
                    void run(async () => {
                      const result = await importCharges(
                        jobId,
                        size || undefined,
                      );
                      setNotice(
                        `${result.created.length} charge(s) copied, ${result.skipped} already on the job.`,
                      );
                    })
                  }
                  type="button"
                >
                  Copy from quote
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
