import Link from "next/link";

export function SettingsSidebarSection({
  active = false,
}: {
  active?: boolean;
}) {
  return (
    <section className="sidebar-settings" aria-labelledby="settings-nav-title">
      <p className="nav-heading settings-heading" id="settings-nav-title">
        SETTINGS
      </p>
      <nav className="settings-nav" aria-label="Settings">
        <Link
          className={`nav-link${active ? " active" : ""}`}
          href="/settings"
          aria-current={active ? "page" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">
            ⚙
          </span>
          Settings
        </Link>
      </nav>
    </section>
  );
}
