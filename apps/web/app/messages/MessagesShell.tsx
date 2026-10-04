"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStaffAccess } from "../auth/useStaffAccess";
import styles from "../jobs/jobs.module.css";

const tabs = [
  { href: "/messages", label: "Sent" },
  { href: "/messages/new", label: "Write a message" },
  { href: "/messages/quotes", label: "Send a quote" },
];

export function MessagesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { roles, status } = useStaffAccess();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Messages</h1>
        </div>
      </header>

      {status === "ready" && roles.length === 0 ? (
        <p className={styles.error} role="status">
          Messages are available to staff accounts.
        </p>
      ) : (
        <>
          <nav className={styles.tabs} aria-label="Messages sections">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`${styles.tab}${active ? ` ${styles.tabActive}` : ""}`}
                  href={tab.href}
                  key={tab.href}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          {children}
        </>
      )}
    </main>
  );
}
