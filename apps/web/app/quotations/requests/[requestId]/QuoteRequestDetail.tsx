"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getQuoteRequest } from "../../quoteRequestApi";
import type { QuoteRequest } from "../../quoteRequestApi";
import styles from "../../quotation.module.css";

type LoadState = "loading" | "ready" | "error";

export function QuoteRequestDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    getQuoteRequest(requestId)
      .then((result) => {
        if (active) {
          setRequest(result);
          setLoadState("ready");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The request could not be loaded",
          );
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [requestId]);

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/quotations">
        <span aria-hidden="true">←</span> Back to request inbox
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · LOCAL ENGINE</p>
          <h1>Quote request</h1>
          <p className={styles.description}>
            Captured customer details and request message.
          </p>
        </div>
        <span className={styles.localBadge}>LOCAL DEVELOPMENT</span>
      </header>

      {loadState === "loading" && (
        <div className={styles.statePanel} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <h3>Loading request</h3>
        </div>
      )}

      {loadState === "error" && (
        <div className={styles.errorPanel} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            !
          </span>
          <div>
            <h3>Request could not be loaded</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {loadState === "ready" && request && (
        <>
          <article className={styles.requestDetail}>
            <header className={styles.detailHeader}>
              <div>
                <p className={styles.sectionEyebrow}>RECEIVED REQUEST</p>
                <h2>{request.companyName}</h2>
              </div>
              <span className={styles.sampleCount}>Received</span>
            </header>
            <dl className={styles.contactGrid}>
              <div>
                <dt>Contact</dt>
                <dd>{request.contactName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{request.email}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>
                  {new Intl.DateTimeFormat("en-GH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Accra",
                  }).format(new Date(request.createdAt))}
                </dd>
              </div>
            </dl>
            <section
              className={styles.messagePanel}
              aria-labelledby="message-title"
            >
              <h3 id="message-title">Request message</h3>
              <p>{request.message}</p>
            </section>
          </article>

          <p className={styles.notIssued}>
            This request has not been priced or issued as a quotation, and no
            job has been created.
          </p>
        </>
      )}
    </main>
  );
}
