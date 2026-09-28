"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCustomer } from "../customerApi";
import type { CustomerCompany } from "../customerApi";
import styles from "./customerProfile.module.css";

type LoadState = "loading" | "ready" | "error";

export function CustomerProfileDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<CustomerCompany | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    getCustomer(customerId)
      .then((result) => {
        if (active) {
          setCustomer(result);
          setLoadState("ready");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The customer could not be loaded",
          );
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [customerId]);

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/customers">
        <span aria-hidden="true">←</span> Back to customers
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · LOCAL ENGINE</p>
          <h1>{customer?.companyName ?? "Customer profile"}</h1>
          <p className={styles.description}>
            Saved company and contact details.
          </p>
        </div>
        <span className={styles.sampleBadge}>LOCAL RECORD</span>
      </header>

      {loadState === "loading" && (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <h2>Loading customer</h2>
        </div>
      )}

      {loadState === "error" && (
        <div className={styles.emptyState} role="alert">
          <h2>Customer could not be loaded</h2>
          <p>{error}</p>
        </div>
      )}

      {loadState === "ready" && customer && (
        <>
          <section
            className={styles.contactCard}
            aria-labelledby="contact-title"
          >
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.sectionEyebrow}>PROFILE</p>
                <h2 id="contact-title">Contacts</h2>
              </div>
              <span className={styles.notConnected}>Local data</span>
            </div>
            <dl className={styles.contactGrid}>
              {customer.contacts.map((contact) => (
                <div key={contact.id}>
                  <dt>{contact.name}</dt>
                  <dd>{contact.email}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            className={styles.historySection}
            aria-labelledby="history-title"
          >
            <div className={styles.historyHeading}>
              <div>
                <p className={styles.sectionEyebrow}>ACTIVITY</p>
                <h2 id="history-title">Customer history</h2>
              </div>
              <span className={styles.localCaption}>LOCAL ENGINE</span>
            </div>
            <div className={styles.historyGrid}>
              <article className={styles.historyCard}>
                <div className={styles.cardHeading}>
                  <h3>Quote requests</h3>
                  <span className={styles.notConnected}>Not linked</span>
                </div>
                <p>Quote requests are not yet linked to customer records.</p>
              </article>
              <article className={styles.historyCard}>
                <div className={styles.cardHeading}>
                  <h3>Jobs</h3>
                  <span className={styles.notConnected}>Not connected</span>
                </div>
                <p>Job records have not been implemented yet.</p>
              </article>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
