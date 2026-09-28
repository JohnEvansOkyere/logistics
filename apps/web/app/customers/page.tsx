import Link from "next/link";
import { CustomerDirectory } from "./CustomerDirectory";
import styles from "./customerDirectory.module.css";

export const metadata = {
  title: "Customer directory | BJH Logistics",
  description: "Local customer company and contact directory.",
};

export default function CustomersPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">
        <span aria-hidden="true">←</span> Back to overview
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · LOCAL ENGINE</p>
          <h1 className={styles.title}>Customer directory</h1>
          <p className={styles.description}>
            Search customer profiles and contact details in the staff directory.
          </p>
        </div>
        <span className={styles.localBadge}>LOCAL DEVELOPMENT</span>
      </header>

      <aside className={styles.sampleNotice} aria-label="Local development notice">
        <span className={styles.noticeMark} aria-hidden="true">
          !
        </span>
        <p>
          <strong>Local development only.</strong> The directory uses local
          SQLite. Use synthetic details; authentication and company access
          enforcement are not part of this slice.
        </p>
      </aside>

      <CustomerDirectory />
    </main>
  );
}
