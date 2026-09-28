"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listCustomers } from "./customerApi";
import type { CustomerCompany } from "./customerApi";
import styles from "./customerDirectory.module.css";

type LoadState = "loading" | "ready" | "error";

export function CustomerDirectory() {
  const [customers, setCustomers] = useState<CustomerCompany[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    setLoadError("");
    listCustomers(query)
      .then((results) => {
        if (active) {
          setCustomers(results);
          setLoadState("ready");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "The customer directory is unavailable",
          );
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [query, retry]);

  return (
    <section className={styles.directory} aria-label="Customer companies">
      <div className={styles.searchHeader}>
        <div>
          <label className={styles.searchLabel} htmlFor="customer-search">
            Search companies and contacts
          </label>
          <p className={styles.searchHint}>
            Search by company, contact name, or email address.
          </p>
        </div>
        <Link className={styles.newCustomerLink} href="/customers/new">
          New customer
        </Link>
      </div>

      <div className={styles.searchRow}>
        <span className={styles.searchIcon} aria-hidden="true">
          ⌕
        </span>
        <input
          autoComplete="off"
          className={styles.searchInput}
          id="customer-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try a company, contact, or email"
          type="search"
          value={query}
        />
        {query && (
          <button
            aria-label="Clear customer search"
            className={styles.clearButton}
            onClick={() => setQuery("")}
            type="button"
          >
            Clear
          </button>
        )}
      </div>

      {loadState === "loading" && (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <h2>Loading customers</h2>
        </div>
      )}

      {loadState === "error" && (
        <div className={styles.emptyState} role="alert">
          <h2>Customers could not be loaded</h2>
          <p>{loadError}</p>
          <button
            className={styles.emptyClearButton}
            onClick={() => setRetry((current) => current + 1)}
            type="button"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && (
        <>
          <p className={styles.resultSummary} role="status" aria-live="polite">
            {customers.length}{" "}
            {customers.length === 1 ? "company" : "companies"}
            {query.trim() ? " match your search" : " in the directory"}
          </p>

          {customers.length > 0 ? (
            <div className={styles.tableScroll}>
              <table className={styles.customerTable}>
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">Contacts</th>
                    <th scope="col">Email addresses</th>
                    <th scope="col">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <th scope="row">
                        <Link
                          className={styles.companyLink}
                          href={`/customers/${customer.id}`}
                        >
                          {customer.companyName}
                        </Link>
                      </th>
                      <td>
                        {customer.contacts
                          .map((contact) => contact.name)
                          .join(", ")}
                      </td>
                      <td className={styles.email}>
                        {customer.contacts
                          .map((contact) => contact.email)
                          .join(", ")}
                      </td>
                      <td>
                        <span className={styles.sampleTag}>Local</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : query.trim() ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">
                ⌕
              </span>
              <h2>No customers match</h2>
              <p>Try another company, contact name, or email address.</p>
              <button
                className={styles.emptyClearButton}
                onClick={() => setQuery("")}
                type="button"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h2>No customers yet</h2>
              <p>Create a company profile to start the customer directory.</p>
              <Link className={styles.emptyClearButton} href="/customers/new">
                New customer
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
