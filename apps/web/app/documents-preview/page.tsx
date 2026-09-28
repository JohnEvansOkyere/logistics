import Link from "next/link";
import { PrintSampleButton } from "./PrintSampleButton";
import styles from "./documentPreview.module.css";

function DocumentBrand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">
        BJH
      </span>
      <span>
        <strong>BJH Logistics</strong>
        <small>Local synthetic layout preview</small>
      </span>
    </div>
  );
}

function Placeholder({ children }: { children: string }) {
  return <span className={styles.placeholder}>{children}</span>;
}

export default function DocumentsPreviewPage() {
  return (
    <main className={styles.previewPage}>
      <header className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>Local design review</p>
          <h1 className={styles.pageTitle}>Document layout previews</h1>
          <p className={styles.toolbarText}>
            Four synthetic, print-friendly structures based on the supplied
            examples. Use your browser’s Print command to preview one document
            per page.
          </p>
        </div>
        <Link className={styles.backLink} href="/">
          Back to foundation
        </Link>
      </header>

      <aside className={styles.notice}>
        <strong>Preview only — not issued documents.</strong> Names and
        references are fictional. Tax, currency, official numbering, and legal
        invoice fields are intentionally placeholders pending approval.
      </aside>

      <article
        className={styles.sheet}
        aria-labelledby="quote-title"
        data-print-sample="quotation"
      >
        <PrintSampleButton sampleId="quotation" sampleName="quotation" />
        <DocumentBrand />
        <div className={styles.documentType}>Quotation · synthetic example</div>
        <h2 id="quote-title" className={styles.documentTitle}>
          Sea freight clearance quotation
        </h2>
        <div className={styles.metadataGrid}>
          <div>
            <span>Quote reference</span>
            <strong>SAMPLE-QUOTE-001</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>Sample date</strong>
          </div>
          <div>
            <span>Prepared for</span>
            <strong>Harbor Demo Ltd</strong>
          </div>
          <div>
            <span>Shipment</span>
            <strong>20 ft FCL · sample cargo</strong>
          </div>
        </div>
        <p className={styles.lead}>
          Sample scope: clearance and delivery for synthetic, non-hazardous
          general cargo. The delivery estimate and all charges require operator
          confirmation.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Charge</th>
              <th>Basis</th>
              <th>Currency</th>
              <th className={styles.numeric}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>BJH service fee</td>
              <td>Per shipment</td>
              <td>
                <Placeholder>[currency]</Placeholder>
              </td>
              <td className={styles.numeric}>
                <Placeholder>[amount]</Placeholder>
              </td>
            </tr>
            <tr>
              <td>Port and shipping-line charges</td>
              <td>Third-party · at cost</td>
              <td>
                <Placeholder>[currency]</Placeholder>
              </td>
              <td className={styles.numeric}>At cost</td>
            </tr>
            <tr>
              <td>Customs duties and taxes</td>
              <td>After assessment</td>
              <td>
                <Placeholder>[currency]</Placeholder>
              </td>
              <td className={styles.numeric}>At cost</td>
            </tr>
          </tbody>
        </table>
        <div className={styles.twoColumn}>
          <section>
            <h3>Documents required</h3>
            <ul>
              <li>Commercial invoice</li>
              <li>Packing list</li>
              <li>Bill of lading and release evidence</li>
            </ul>
          </section>
          <section>
            <h3>Conditions</h3>
            <p>
              At-cost charges may vary. Scope, timing, exclusions, and
              acceptance wording require review before use.
            </p>
          </section>
        </div>
        <div className={styles.signatureGrid}>
          <div>
            For BJH Logistics <span>Authorised signature / date</span>
          </div>
          <div>
            Accepted by customer <span>Name / signature / date</span>
          </div>
        </div>
      </article>

      <article
        className={styles.sheet}
        aria-labelledby="invoice-title"
        data-print-sample="invoice"
      >
        <PrintSampleButton sampleId="invoice" sampleName="draft invoice" />
        <DocumentBrand />
        <div className={styles.documentType}>
          Customer invoice · draft structure
        </div>
        <h2 id="invoice-title" className={styles.documentTitle}>
          Invoice
        </h2>
        <div className={styles.metadataGrid}>
          <div>
            <span>Invoice number</span>
            <strong>
              <Placeholder>[approved numbering]</Placeholder>
            </strong>
          </div>
          <div>
            <span>Issue date</span>
            <strong>
              <Placeholder>[date]</Placeholder>
            </strong>
          </div>
          <div>
            <span>Bill to</span>
            <strong>Harbor Demo Ltd</strong>
          </div>
          <div>
            <span>Job / shipment reference</span>
            <strong>SAMPLE-JOB-001</strong>
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity / basis</th>
              <th className={styles.numeric}>Unit amount</th>
              <th className={styles.numeric}>Line amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sample BJH service</td>
              <td>1 shipment</td>
              <td className={styles.numeric}>
                <Placeholder>[amount]</Placeholder>
              </td>
              <td className={styles.numeric}>
                <Placeholder>[amount]</Placeholder>
              </td>
            </tr>
            <tr>
              <td>Third-party charge</td>
              <td>At cost</td>
              <td className={styles.numeric}>—</td>
              <td className={styles.numeric}>
                <Placeholder>[actual cost]</Placeholder>
              </td>
            </tr>
          </tbody>
        </table>
        <div className={styles.totals}>
          <div>
            <span>Subtotal</span>
            <strong>
              <Placeholder>[amount]</Placeholder>
            </strong>
          </div>
          <div>
            <span>Approved tax/levy components</span>
            <strong>
              <Placeholder>[approved breakdown]</Placeholder>
            </strong>
          </div>
          <div className={styles.grandTotal}>
            <span>Total due</span>
            <strong>
              <Placeholder>[currency and amount]</Placeholder>
            </strong>
          </div>
        </div>
        <p className={styles.noticeInline}>
          Draft layout only. Tax rates, tax basis, legal invoice status,
          exchange rules, and payment terms are not configured in this preview.
        </p>
        <p className={styles.amountWords}>
          Amount in words: <Placeholder>[approved amount in words]</Placeholder>
        </p>
        <div className={styles.footerNote}>
          Payment instructions:{" "}
          <Placeholder>[approved BJH instructions]</Placeholder>
        </div>
      </article>

      <article
        className={styles.sheet}
        aria-labelledby="bill-title"
        data-print-sample="transport"
      >
        <PrintSampleButton sampleId="transport" sampleName="transport layout" />
        <DocumentBrand />
        <div className={styles.documentType}>
          Transport document · field layout only
        </div>
        <h2 id="bill-title" className={styles.documentTitle}>
          Bill of lading data preview
        </h2>
        <p className={styles.warning}>
          Not a carrier form or valid bill of lading. Use the carrier’s approved
          document for issuance.
        </p>
        <div className={styles.partyGrid}>
          <section>
            <h3>Shipper</h3>
            <p>
              Harbor Demo Ltd
              <br />
              Synthetic shipper address
            </p>
          </section>
          <section>
            <h3>Consignee</h3>
            <p>
              Cedar Demo Ltd
              <br />
              Synthetic consignee address
            </p>
          </section>
          <section>
            <h3>Notify party</h3>
            <p>
              <Placeholder>[notify party / contact]</Placeholder>
            </p>
          </section>
          <section>
            <h3>Forwarding agent</h3>
            <p>BJH Logistics · sample</p>
          </section>
        </div>
        <div className={styles.metadataGrid}>
          <div>
            <span>Master reference</span>
            <strong>
              <Placeholder>[carrier reference]</Placeholder>
            </strong>
          </div>
          <div>
            <span>House reference</span>
            <strong>SAMPLE-HBL-001</strong>
          </div>
          <div>
            <span>Port of loading</span>
            <strong>
              <Placeholder>[origin]</Placeholder>
            </strong>
          </div>
          <div>
            <span>Port of discharge</span>
            <strong>
              <Placeholder>[destination]</Placeholder>
            </strong>
          </div>
          <div>
            <span>Vessel / voyage</span>
            <strong>
              <Placeholder>[carrier details]</Placeholder>
            </strong>
          </div>
          <div>
            <span>Freight terms</span>
            <strong>
              <Placeholder>[prepaid / collect]</Placeholder>
            </strong>
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Container / seal</th>
              <th>Packages / cargo</th>
              <th>Weight / volume</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                SAMPLE-CONTAINER
                <br />
                SAMPLE-SEAL
              </td>
              <td>Synthetic general cargo</td>
              <td>
                <Placeholder>[weight / volume]</Placeholder>
              </td>
            </tr>
          </tbody>
        </table>
        <div className={styles.signatureGrid}>
          <div>
            Place / issue date{" "}
            <span>
              <Placeholder>[carrier-approved details]</Placeholder>
            </span>
          </div>
          <div>
            Carrier / authorised signature <span>Reference layout only</span>
          </div>
        </div>
      </article>

      <article
        className={styles.sheet}
        aria-labelledby="receipt-title"
        data-print-sample="receipt"
      >
        <PrintSampleButton sampleId="receipt" sampleName="payment receipt" />
        <DocumentBrand />
        <div className={styles.documentType}>
          Payment receipt · synthetic structure
        </div>
        <h2 id="receipt-title" className={styles.documentTitle}>
          Receipt
        </h2>
        <p className={styles.warning}>
          Record of payment received outside the app; not a bank confirmation.
        </p>
        <div className={styles.receiptPanel}>
          <div className={styles.metadataGrid}>
            <div>
              <span>Receipt number</span>
              <strong>
                <Placeholder>[approved receipt number]</Placeholder>
              </strong>
            </div>
            <div>
              <span>Date received</span>
              <strong>
                <Placeholder>[date]</Placeholder>
              </strong>
            </div>
            <div>
              <span>Received from</span>
              <strong>Harbor Demo Ltd</strong>
            </div>
            <div>
              <span>Related invoice / job</span>
              <strong>SAMPLE-JOB-001</strong>
            </div>
          </div>
          <div className={styles.receiptAmount}>
            <span>Amount received</span>
            <strong>
              <Placeholder>[currency and amount]</Placeholder>
            </strong>
            <small>
              Amount in words: <Placeholder>[amount in words]</Placeholder>
            </small>
          </div>
          <div className={styles.metadataGrid}>
            <div>
              <span>Payment method</span>
              <strong>
                <Placeholder>[method]</Placeholder>
              </strong>
            </div>
            <div>
              <span>External payment reference</span>
              <strong>
                <Placeholder>[reference]</Placeholder>
              </strong>
            </div>
          </div>
          <div className={styles.signatureGrid}>
            <div>
              Received by{" "}
              <span>
                <Placeholder>[BJH staff name]</Placeholder>
              </span>
            </div>
            <div>
              Signature / stamp <span> </span>
            </div>
          </div>
        </div>
        <p className={styles.footerNote}>
          Receipt numbering, required wording, and payment-allocation rules
          require finance review before use.
        </p>
      </article>
    </main>
  );
}
