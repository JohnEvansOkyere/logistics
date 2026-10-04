import Link from "next/link";
import { NavIcon } from "./NavIcon";

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
          title="Settings"
        >
          <NavIcon name="settings" />
          <span className="nav-label">Settings</span>
        </Link>
      </nav>
    </section>
  );
}
