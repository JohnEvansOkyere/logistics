const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";

export default function HomePage() {
  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          aria-label="BJH Logistics overview"
        >
          <span className="brand-mark" aria-hidden="true">
            BJH
          </span>
          <span className="brand-copy">
            <strong>BJH Logistics</strong>
            <small>Operations workspace</small>
          </span>
        </a>

        <p className="nav-heading">WORKSPACE</p>
        <nav className="workspace-nav" aria-label="Staff workspace">
          <a className="nav-link active" href="#overview" aria-current="page">
            <span className="nav-icon" aria-hidden="true">
              ◫
            </span>
            Overview
          </a>
          <a className="nav-link" href="/customers">
            <span className="nav-icon" aria-hidden="true">
              ◉
            </span>
            Customers
          </a>
          <a className="nav-link" href="/quotations">
            <span className="nav-icon" aria-hidden="true">
              ≡
            </span>
            Quotations
          </a>
          <a className="nav-link" href="#jobs">
            <span className="nav-icon" aria-hidden="true">
              ▣
            </span>
            Jobs
          </a>
          <a className="nav-link" href="/documents-preview">
            <span className="nav-icon" aria-hidden="true">
              ▤
            </span>
            Document previews
          </a>
        </nav>

        <div className="sidebar-note">
          <span className="local-indicator" aria-hidden="true" />
          <div>
            <strong>Local workspace</strong>
            <p>Sign-in and business data are not connected.</p>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <span>Staff workspace</span>
          <a href={`${apiBaseUrl}/health`}>
            Check API health <span aria-hidden="true">↗</span>
          </a>
        </header>

        <main className="dashboard" id="overview">
          <section className="welcome-row" aria-labelledby="page-title">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1 id="page-title">Operations overview</h1>
              <p className="welcome-copy">
                Your staff workspace is ready for the next stage of local
                development.
              </p>
            </div>
            <span className="environment-badge">LOCAL DEVELOPMENT</span>
          </section>

          <section
            className="connection-notice"
            aria-label="Workspace data status"
          >
            <span className="notice-icon" aria-hidden="true">
              i
            </span>
            <p>
              <strong>No operational data is loaded.</strong> This is a frontend
              shell; sign-in and business records are not connected.
            </p>
          </section>

          <section className="modules-section" aria-labelledby="modules-title">
            <div className="section-heading">
              <div>
                <h2 id="modules-title">Workspace modules</h2>
                <p>Interface foundations for day-to-day operations.</p>
              </div>
              <span className="section-caption">NO LIVE RECORDS</span>
            </div>

            <div className="module-grid">
              <article className="module-card" id="customers">
                <div className="module-card-top">
                  <span
                    className="module-icon customer-icon"
                    aria-hidden="true"
                  >
                    ◉
                  </span>
                  <span className="module-status">Not connected</span>
                </div>
                <h3>Customers</h3>
                <p>Customer profiles and contact workspace.</p>
                <a className="module-link" href="/customers">
                  Open sample directory <span aria-hidden="true">→</span>
                </a>
              </article>

              <article className="module-card" id="quotations">
                <div className="module-card-top">
                  <span className="module-icon quote-icon" aria-hidden="true">
                    ≡
                  </span>
                  <span className="module-status">Not connected</span>
                </div>
                <h3>Quotations</h3>
                <p>Quote requests, drafts, and review workspace.</p>
                <a className="module-link" href="/quotations">
                  Open sample inbox <span aria-hidden="true">→</span>
                </a>
              </article>

              <article className="module-card" id="jobs">
                <div className="module-card-top">
                  <span className="module-icon jobs-icon" aria-hidden="true">
                    ▣
                  </span>
                  <span className="module-status">Not connected</span>
                </div>
                <h3>Jobs</h3>
                <p>Job files, milestones, and assigned work.</p>
                <span className="module-footnote">UI foundation</span>
              </article>

              <article className="module-card">
                <div className="module-card-top">
                  <span
                    className="module-icon documents-icon"
                    aria-hidden="true"
                  >
                    ▤
                  </span>
                  <span className="module-status preview-status">
                    Preview only
                  </span>
                </div>
                <h3>Documents</h3>
                <p>Synthetic layouts for structural review and printing.</p>
                <a className="module-link" href="/documents-preview">
                  Open document previews <span aria-hidden="true">→</span>
                </a>
              </article>
            </div>
          </section>

          <footer className="dashboard-footer">
            <span>BJH Logistics · Local development</span>
            <span>
              No client records or operational activity are displayed.
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
