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
    </>
  );
}
