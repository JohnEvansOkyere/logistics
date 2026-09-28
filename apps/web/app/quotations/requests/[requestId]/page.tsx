import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "../../quotation.module.css";
import { sampleQuoteRequests } from "../../sampleQuoteRequests";

export const metadata = {
  title: "Sample quotation request | BJH Logistics",
  description: "Synthetic quotation request for local UI review.",
};

export function generateStaticParams() {
  return sampleQuoteRequests.map((request) => ({ requestId: request.id }));
}

export default async function QuoteRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const request = sampleQuoteRequests.find((entry) => entry.id === requestId);

  if (!request) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/quotations">
        <span aria-hidden="true">←</span> Back to request inbox
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>SYNTHETIC SAMPLE · REQUEST DETAIL</p>
          <h1>Quotation request</h1>
          <p className={styles.description}>
            Fictional request details for reviewing the staff inbox layout.
          </p>
        </div>
        <span className={styles.localBadge}>LOCAL DEVELOPMENT</span>
      </header>

      <aside className={styles.sampleNotice} aria-label="Sample request notice">
        <span aria-hidden="true">i</span>
        <p>
          Synthetic request only. No quotation, price, or job has been created;
          this page is not connected to an API or Supabase.
        </p>
      </aside>

      <article className={styles.requestDetail}>
        <header className={styles.detailHeader}>
          <div>
            <p className={styles.sectionEyebrow}>SAMPLE REQUEST</p>
            <h2>{request.companyName}</h2>
          </div>
          <span className={styles.sampleCount}>Not submitted</span>
        </header>
        <dl className={styles.contactGrid}>
          <div>
            <dt>Contact</dt>
            <dd>{request.contactName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{request.email}</dd>
          </div>
        </dl>
        <section
          className={styles.messagePanel}
          aria-labelledby="message-title"
        >
          <h3 id="message-title">Request message</h3>
          <p>{request.message}</p>
        </section>
      </article>

      <p className={styles.notIssued}>
        This sample does not contain pricing, an issued quotation, or a job
        conversion action. Approved quote content and terms remain to be
        confirmed.
      </p>
    </main>
  );
}
