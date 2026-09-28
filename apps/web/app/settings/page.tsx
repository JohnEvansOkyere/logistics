import Link from "next/link";
import { AuthStatus } from "../auth/AuthStatus";
import { SettingsSidebarSection } from "../SettingsSidebarSection";

export default function SettingsPage() {
  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="BJH Logistics overview">
          <span className="brand-mark" aria-hidden="true">
            BJH
          </span>
          <span className="brand-copy">
            <strong>BJH Logistics</strong>
            <small>Operations</small>
          </span>
        </Link>
        <p className="nav-heading">WORKSPACE</p>
        <nav className="workspace-nav" aria-label="Staff workspace">
          <Link className="nav-link" href="/">
            Overview
          </Link>
          <Link className="nav-link" href="/customers">
            Customers
          </Link>
          <Link className="nav-link" href="/quotations">
            Quotations
          </Link>
        </nav>
        <SettingsSidebarSection active />
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <Link href="/">Workspace</Link>
            <span aria-hidden="true">/</span>
            <strong>Settings</strong>
          </div>
          <AuthStatus />
        </header>
        <main className="dashboard">
          <section className="welcome-row" aria-labelledby="settings-title">
            <div>
              <p className="eyebrow">WORKSPACE CONFIGURATION</p>
              <h1 id="settings-title">Settings</h1>
              <p className="welcome-copy">
                Manage staff access and review system status.
              </p>
            </div>
          </section>
          <section className="action-grid" aria-label="Settings pages">
            <article className="action-card">
              <span className="action-icon" aria-hidden="true">
                ♙
              </span>
              <div className="action-copy">
                <p className="action-kicker">ACCESS</p>
                <h3>Staff management</h3>
                <p>Invite staff and review their role assignments.</p>
              </div>
              <Link className="action-link" href="/settings/staff">
                Manage staff <span aria-hidden="true">→</span>
              </Link>
            </article>
            <article className="action-card">
              <span className="action-icon" aria-hidden="true">
                ◷
              </span>
              <div className="action-copy">
                <p className="action-kicker">SYSTEM</p>
                <h3>System status</h3>
                <p>
                  Check whether the application API and database are available.
                </p>
              </div>
              <Link className="action-link" href="/settings/system-status">
                View status <span aria-hidden="true">→</span>
              </Link>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
