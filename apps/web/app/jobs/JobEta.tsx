"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getEta, recordEta } from "./jobApi";
import type { Eta } from "./jobApi";
import styles from "./jobs.module.css";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function JobEta({
  jobId,
  canEdit,
}: {
  jobId: string;
  canEdit: boolean;
}) {
  const [eta, setEta] = useState<Eta | null>(null);
  const [error, setError] = useState("");
  const [etaAt, setEtaAt] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setEta(await getEta(jobId));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The ETA could not be loaded",
      );
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await recordEta(jobId, {
        etaAt: new Date(etaAt).toISOString(),
        source: source.trim(),
        note: note.trim() || undefined,
        correctionOf: eta?.current?.id,
      });
      setEtaAt("");
      setSource("");
      setNote("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  }

  return (
    <section className={styles.card} aria-labelledby="eta-title">
      <h2 id="eta-title">ETA</h2>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {eta?.current ? (
        <p>
          <strong>{formatDate(eta.current.etaAt)}</strong>
          <span className={styles.muted}>
            {" "}
            · {eta.current.source}, recorded{" "}
            {formatDate(eta.current.recordedAt)}
          </span>
        </p>
      ) : (
        <p className={styles.muted}>No ETA recorded.</p>
      )}
      {eta && eta.history.length > 1 && (
        <>
          <h2 style={{ marginTop: 16 }}>ETA history</h2>
          <ul className={styles.list}>
            {[...eta.history].reverse().map((item) => (
              <li key={item.id}>
                {formatDate(item.etaAt)} · {item.source}
                {item.note ? ` — ${item.note}` : ""} (recorded{" "}
                {formatDate(item.recordedAt)})
              </li>
            ))}
          </ul>
        </>
      )}
      {canEdit && (
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <label className={styles.field}>
            {eta?.current ? "New ETA (replaces the current one)" : "ETA"}
            <input
              onChange={(event) => setEtaAt(event.target.value)}
              required
              type="datetime-local"
              value={etaAt}
            />
          </label>
          <label className={styles.field}>
            Source (for example carrier notice, agent email)
            <input
              onChange={(event) => setSource(event.target.value)}
              required
              value={source}
            />
          </label>
          <label className={styles.field}>
            Note (optional)
            <input
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
          <button className={styles.button} type="submit">
            Record ETA
          </button>
        </form>
      )}
    </section>
  );
}
