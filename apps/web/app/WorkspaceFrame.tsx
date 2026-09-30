"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SettingsSidebarSection } from "./SettingsSidebarSection";

export function WorkspaceFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/sign-in" || pathname === "/complete-invitation") {
    return children;
  }

  const customersActive = pathname.startsWith("/customers");
  const jobsActive = pathname.startsWith("/jobs");
  const quotesActive = pathname.startsWith("/quotes");
  const transportActive = pathname.startsWith("/transport");
  const tasksActive = pathname.startsWith("/tasks");
  const quotationsActive = pathname.startsWith("/quotations");
  const settingsActive =
    pathname.startsWith("/settings") || pathname === "/admin/users";

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
          <Link
            className={`nav-link${pathname === "/" ? " active" : ""}`}
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              ◫
            </span>
            Overview
          </Link>
          <Link
            className={`nav-link${customersActive ? " active" : ""}`}
            href="/customers"
            aria-current={customersActive ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              ◉
            </span>
            Customers
          </Link>
          <Link
            className={`nav-link${jobsActive ? " active" : ""}`}
            href="/jobs"
            aria-current={jobsActive ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              ▤
            </span>
            Jobs
          </Link>
          <Link
            className={`nav-link${quotesActive ? " active" : ""}`}
            href="/quotes"
            aria-current={quotesActive ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              ❐
            </span>
            Quotes
          </Link>
          <Link
            className={`nav-link${transportActive ? " active" : ""}`}
            href="/transport"
            aria-current={transportActive ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              ⛟
            </span>
            Transport
          </Link>
          <Link
            className={`nav-link${tasksActive ? " active" : ""}`}
            href="/tasks"
            aria-current={tasksActive ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              ✓
            </span>
            Tasks
          </Link>
          <Link
            className={`nav-link${quotationsActive ? " active" : ""}`}
            href="/quotations"
            aria-current={quotationsActive ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              ≡
            </span>
            Quotations
          </Link>
        </nav>

        <SettingsSidebarSection active={settingsActive} />

        <div className="sidebar-note">
          <span className="local-indicator" aria-hidden="true" />
          <div>
            <strong>Local environment</strong>
            <p>Connected to the local Supabase stack.</p>
          </div>
        </div>
      </aside>

      <div className="workspace-main">{children}</div>
    </div>
  );
}
