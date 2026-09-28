"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerProfile } from "./sampleCustomers";
import styles from "./customerDirectory.module.css";

export function CustomerDirectory({
  customers,
}: {
  customers: CustomerProfile[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filteredCustomers = useMemo(() => {
    if (!normalizedQuery) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.companyName, customer.contactName, customer.email].some(
        (value) => value.toLocaleLowerCase().includes(normalizedQuery),
      ),
    );
  }, [customers, normalizedQuery]);

  return (
    <section className={styles.directory} aria-label="Sample customer profiles">
      <div className={styles.searchHeader}>
        <div>
          <label className={styles.searchLabel} htmlFor="customer-search">
            Search customers and contacts
          </label>
          <p className={styles.searchHint}>
            Search by company, contact name, or email address.
          </p>
        </div>
        <span className={styles.sampleCount}>Sample directory</span>
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

      <p className={styles.resultSummary} role="status" aria-live="polite">
        Showing {filteredCustomers.length} of {customers.length} sample
        {customers.length === 1 ? " profile" : " profiles"}
      </p>

      {filteredCustomers.length > 0 ? (
        <div className={styles.tableScroll}>
          <table className={styles.customerTable}>
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Primary contact</th>
                <th scope="col">Email</th>
                <th scope="col">Record</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.email}>
                  <th scope="row">
                    <Link
                      className={styles.companyLink}
                      href={`/customers/${customer.id}`}
                    >
                      {customer.companyName}
                    </Link>
                  </th>
                  <td>{customer.contactName}</td>
                  <td className={styles.email}>{customer.email}</td>
                  <td>
                    <span className={styles.sampleTag}>Synthetic</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">
            ⌕
          </span>
          <h2>No sample profiles found</h2>
          <p>Try another company, contact name, or email address.</p>
          <button
            className={styles.emptyClearButton}
            onClick={() => setQuery("")}
            type="button"
          >
            Clear search
          </button>
        </div>
      )}
    </section>
  );
}
