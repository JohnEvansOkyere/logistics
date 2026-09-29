import Link from "next/link";
import { AuthStatus } from "./auth/AuthStatus";

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          <span>Workspace</span>
          <span aria-hidden="true">/</span>
          <strong>Overview</strong>
        </div>
        <div className="topbar-actions">
          <AuthStatus />
        </div>
      </header>

      <main className="dashboard" id="overview">
        <section className="welcome-row" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">OPERATIONS</p>
            <h1 id="page-title">Good work starts with a clear handoff.</h1>
            <p className="welcome-copy">
              Keep customer records and quote requests moving from first contact
              to a reviewed draft.
            </p>
          </div>
          <span className="environment-badge">
            <span className="status-dot" />
            LOCAL WORKSPACE
          </span>
        </section>

        <section className="work-panel" aria-labelledby="work-title">
          <div className="work-panel-heading">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h2 id="work-title">What would you like to take care of?</h2>
            </div>
            <p className="work-panel-note">Choose an action to get started.</p>
          </div>

          <div className="action-grid">
            <article className="action-card primary-action">
              <span className="action-icon" aria-hidden="true">
                ＋
              </span>
              <div className="action-copy">
                <p className="action-kicker">QUOTATIONS</p>
                <h3>Start a quote request</h3>
                <p>
                  Capture the service details and prepare the request for
                  follow-up.
                </p>
              </div>
              <Link className="action-link" href="/quotations/new-request">
                Create request <span aria-hidden="true">→</span>
              </Link>
            </article>

            <article className="action-card">
              <span
                className="action-icon customer-action-icon"
                aria-hidden="true"
              >
                ◉
              </span>
              <div className="action-copy">
                <p className="action-kicker">CUSTOMERS</p>
                <h3>Add a customer</h3>
                <p>
                  Keep company and contact details together for future requests.
                </p>
              </div>
              <Link className="action-link" href="/customers/new">
                Add customer <span aria-hidden="true">→</span>
              </Link>
            </article>
          </div>
        </section>

        <section className="desk-section" aria-labelledby="desk-title">
          <div className="desk-heading">
            <div>
              <p className="eyebrow">DAILY WORK</p>
              <h2 id="desk-title">Keep the desk moving</h2>
            </div>
            <Link className="text-link" href="/quotations">
              Open quotation desk <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="workflow-strip">
            <div className="workflow-step">
              <span className="step-number">01</span>
              <div>
                <strong>Record the request</strong>
                <p>Capture what the customer needs.</p>
              </div>
            </div>
            <span className="workflow-connector" aria-hidden="true" />
            <div className="workflow-step">
              <span className="step-number">02</span>
              <div>
                <strong>Prepare a draft</strong>
                <p>Save revisions against the request.</p>
              </div>
            </div>
            <span className="workflow-connector" aria-hidden="true" />
            <div className="workflow-step">
              <span className="step-number">03</span>
              <div>
                <strong>Review before sending</strong>
                <p>Keep approval and issue actions deliberate.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="dashboard-footer">
          <span>
            BJH Logistics <span aria-hidden="true">·</span> Staff workspace
          </span>
          <span>Local development environment</span>
        </footer>
      </main>
    </>
  );
}
