import Link from "next/link";
import { RequestComposer } from "../RequestComposer";
import styles from "../quotation.module.css";

export const metadata = {
  title: "New quote request | BJH Logistics",
  description: "Create a local quote request for the staff inbox.",
};

export default function NewRequestPreviewPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/quotations">
        <span aria-hidden="true">←</span> Back to request inbox
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · LOCAL ENGINE</p>
          <h1>Quotation request intake</h1>
          <p className={styles.description}>
            Capture contact details and the customer's request for follow-up.
          </p>
        </div>
        <span className={styles.localBadge}>LOCAL DEVELOPMENT</span>
      </header>

      <aside
        className={styles.sampleNotice}
        aria-label="Local development notice"
      >
        <span aria-hidden="true">i</span>
        <p>
          <strong>Local development only.</strong> Requests are stored in local
          database. Use synthetic details. Pricing, quote terms, and job
          creation are not part of this intake step.
        </p>
      </aside>

      <RequestComposer />
    </main>
  );
}
