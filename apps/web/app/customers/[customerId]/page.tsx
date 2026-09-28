import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./customerProfile.module.css";
import { sampleCustomers } from "../sampleCustomers";

export const metadata = {
  title: "Customer profile | BJH Logistics",
  description: "Synthetic customer profile prototype for local UI review.",
};

export function generateStaticParams() {
  return sampleCustomers.map((customer) => ({ customerId: customer.id }));
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const customer = sampleCustomers.find((entry) => entry.id === customerId);

  if (!customer) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/customers">
        <span aria-hidden="true">←</span> Back to customers
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>SYNTHETIC SAMPLE · CUSTOMER PROFILE</p>
          <h1>{customer.companyName}</h1>
          <p className={styles.description}>
            Fictional profile for reviewing the customer-detail layout.
          </p>
        </div>
        <span className={styles.sampleBadge}>SAMPLE RECORD</span>
      </header>

      <aside className={styles.sampleNotice} aria-label="Sample profile notice">
        <span aria-hidden="true">i</span>
        <p>
          This is synthetic UI data only. No customer record or history has been
          loaded from an API or Supabase.
        </p>
      </aside>

      <section className={styles.contactCard} aria-labelledby="contact-title">
        <div className={styles.cardHeading}>
          <div>
            <p className={styles.sectionEyebrow}>PROFILE</p>
            <h2 id="contact-title">Contact details</h2>
          </div>
          <span className={styles.notConnected}>Not connected</span>
        </div>
        <dl className={styles.contactGrid}>
          <div>
            <dt>Primary contact</dt>
            <dd>{customer.contactName}</dd>
          </div>
          <div>
            <dt>Email address</dt>
            <dd>{customer.email}</dd>
          </div>
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
          <span className={styles.localCaption}>LOCAL PROTOTYPE</span>
        </div>
        <div className={styles.historyGrid}>
          <article className={styles.historyCard}>
            <div className={styles.cardHeading}>
              <h3>Quotes</h3>
              <span className={styles.notConnected}>Not connected</span>
            </div>
            <p>
              Quote requests and quotation history will appear here when that
              workflow is connected.
            </p>
          </article>
          <article className={styles.historyCard}>
            <div className={styles.cardHeading}>
              <h3>Jobs</h3>
              <span className={styles.notConnected}>Not connected</span>
            </div>
            <p>
              Customer job history will appear here when operational records are
              connected.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
