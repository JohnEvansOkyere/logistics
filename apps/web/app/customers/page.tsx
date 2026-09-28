import Link from "next/link";
import { CustomerDirectory } from "./CustomerDirectory";
import styles from "./customerDirectory.module.css";
import { sampleCustomers } from "./sampleCustomers";

export const metadata = {
  title: "Customer directory | BJH Logistics",
  description: "Synthetic customer directory prototype for local UI review.",
};

export default function CustomersPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">
        <span aria-hidden="true">←</span> Back to overview
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · UI PROTOTYPE</p>
          <h1 className={styles.title}>Customer directory</h1>
          <p className={styles.description}>
            Search customer profiles and contact details in the staff directory.
          </p>
        </div>
        <span className={styles.localBadge}>LOCAL DEVELOPMENT</span>
      </header>

      <aside className={styles.sampleNotice} aria-label="Sample data notice">
        <span className={styles.noticeMark} aria-hidden="true">
          !
        </span>
        <p>
          <strong>Synthetic sample data only.</strong> These fictional records
          are for interface review. No client data, API, or Supabase connection
          is used.
        </p>
      </aside>

      <CustomerDirectory customers={sampleCustomers} />
    </main>
  );
}
