import Link from "next/link";
import { CustomerCreateForm } from "../CustomerCreateForm";
import styles from "../customerDirectory.module.css";

export const metadata = {
  title: "New customer | BJH Logistics",
  description: "Create a local customer company and primary contact.",
};

export default function NewCustomerPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/customers">
        <span aria-hidden="true">←</span> Back to customers
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · LOCAL ENGINE</p>
          <h1 className={styles.title}>New customer</h1>
          <p className={styles.description}>
            Create a company record and its first contact.
          </p>
        </div>
        <span className={styles.localBadge}>LOCAL DEVELOPMENT</span>
      </header>

      <aside
        className={styles.sampleNotice}
        aria-label="Local development notice"
      >
        <span className={styles.noticeMark} aria-hidden="true">
          i
        </span>
        <p>
          <strong>Local development only.</strong> Use synthetic details.
          Similar company names are saved separately; no automatic merging is
          performed.
        </p>
      </aside>

      <CustomerCreateForm />
    </main>
  );
}
