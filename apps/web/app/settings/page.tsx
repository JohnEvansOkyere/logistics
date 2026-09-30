import Link from "next/link";
import { AuthStatus } from "../auth/AuthStatus";

export default function SettingsPage() {
  return (
    <>
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
              Manage staff access, review user activity and check system status.
            </p>
          </div>
        </section>
        <section className="action-grid" aria-label="Settings pages">
          <article className="action-card">
            <span className="action-icon" aria-hidden="true">
              ⚙
            </span>
            <div className="action-copy">
              <p className="action-kicker">BUSINESS</p>
              <h3>Business settings</h3>
              <p>
                Issuer details, currencies, tax lines, numbering and quote
                defaults.
              </p>
            </div>
            <Link className="action-link" href="/settings/business">
              Open settings <span aria-hidden="true">→</span>
            </Link>
          </article>
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
              ⚑
            </span>
            <div className="action-copy">
              <p className="action-kicker">ACCESS</p>
              <h3>Customer accounts</h3>
              <p>Create customer sign-ins and link them to their company.</p>
            </div>
            <Link className="action-link" href="/settings/customer-accounts">
              Manage customers <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="action-card">
            <span className="action-icon" aria-hidden="true">
              ✉
            </span>
            <div className="action-copy">
              <p className="action-kicker">MESSAGES</p>
              <h3>Customer messages</h3>
              <p>See what was sent by email and SMS, and retry failures.</p>
            </div>
            <Link className="action-link" href="/settings/notifications">
              View messages <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="action-card">
            <span className="action-icon" aria-hidden="true">
              ☰
            </span>
            <div className="action-copy">
              <p className="action-kicker">AUDIT</p>
              <h3>Activity log</h3>
              <p>See what every user has done, including denied attempts.</p>
            </div>
            <Link className="action-link" href="/settings/activity">
              View activity <span aria-hidden="true">→</span>
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
    </>
  );
}
