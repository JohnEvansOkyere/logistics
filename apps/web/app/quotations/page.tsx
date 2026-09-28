import Link from "next/link";
import { RequestInbox } from "./RequestInbox";
import styles from "./quotation.module.css";
import { sampleQuoteRequests } from "./sampleQuoteRequests";

export const metadata = {
  title: "Quotation requests | BJH Logistics",
  description:
    "Synthetic quotation-request inbox prototype for local UI review.",
};

export default function QuotationsPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">
        <span aria-hidden="true">←</span> Back to overview
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · UI PROTOTYPE</p>
          <h1>Quotation requests</h1>
          <p className={styles.description}>
            A local preview of the staff request inbox and review screen.
          </p>
        </div>
        <span className={styles.localBadge}>LOCAL DEVELOPMENT</span>
      </header>

      <aside className={styles.sampleNotice} aria-label="Sample data notice">
        <span aria-hidden="true">i</span>
        <p>
          <strong>Synthetic request examples only.</strong> No client requests,
          pricing, issued quotations, or job records are loaded. This page is
          not connected to an API or Supabase.
        </p>
      </aside>

      <RequestInbox requests={sampleQuoteRequests} />
    </main>
  );
}
