import Link from "next/link";
import { RequestComposer } from "../RequestComposer";
import styles from "../quotation.module.css";

export const metadata = {
  title: "Request preview | BJH Logistics",
  description: "Non-submitting quotation request form UI preview.",
};

export default function NewRequestPreviewPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/quotations">
        <span aria-hidden="true">←</span> Back to request inbox
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · FORM PREVIEW</p>
          <h1>Quotation request intake</h1>
          <p className={styles.description}>
            Review a minimal contact-and-message form without creating a live
            request.
          </p>
        </div>
        <span className={styles.localBadge}>LOCAL DEVELOPMENT</span>
      </header>

      <aside className={styles.sampleNotice} aria-label="Form preview notice">
        <span aria-hidden="true">i</span>
        <p>
          <strong>Preview only.</strong> Use fictional details. This form does
          not submit or store information, and has no API or Supabase
          connection. Service types, pricing, and quote terms are intentionally
          omitted.
        </p>
      </aside>

      <RequestComposer />
    </main>
  );
}
