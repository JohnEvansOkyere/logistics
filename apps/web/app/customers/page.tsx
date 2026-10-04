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
          <h1 className={styles.title}>Customer directory</h1>
        </div>
      </header>

      <CustomerDirectory />
    </main>
  );
}
