import Link from "next/link";
import { RequestInbox } from "./RequestInbox";
import styles from "./quotation.module.css";

export const metadata = {
  title: "Quotation requests | BJH Logistics",
  description: "Local quote-request inbox for BJH Logistics staff.",
};

export default function QuotationsPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">
        <span aria-hidden="true">←</span> Back to overview
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · LOCAL ENGINE</p>
          <h1>Quotation requests</h1>
          <p className={styles.description}>
            Review requests submitted to the local business API.
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
          <strong>Local development only.</strong> Requests are saved in the
          local database. Use synthetic details; pricing, issued quotations, and
          job records are not part of this slice.
        </p>
      </aside>

      <RequestInbox />
    </main>
  );
}
