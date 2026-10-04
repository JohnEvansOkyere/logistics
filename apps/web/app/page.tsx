import { AuthStatus } from "./auth/AuthStatus";
import { PortalRedirect } from "./portal/PortalRedirect";
import { OverviewDashboard } from "./overview/OverviewDashboard";

export default function HomePage() {
  return (
    <>
      <PortalRedirect />
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

      <OverviewDashboard />
    </>
  );
}
