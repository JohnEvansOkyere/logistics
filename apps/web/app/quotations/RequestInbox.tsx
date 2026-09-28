"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SampleQuoteRequest } from "./sampleQuoteRequests";
import styles from "./quotation.module.css";

type PreviewState = "samples" | "empty" | "loading" | "error";

export function RequestInbox({ requests }: { requests: SampleQuoteRequest[] }) {
  const [previewState, setPreviewState] = useState<PreviewState>("samples");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filteredRequests = useMemo(() => {
    if (!normalizedQuery) {
      return requests;
    }

    return requests.filter((request) =>
      [
        request.companyName,
        request.contactName,
        request.email,
        request.message,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, requests]);

  return (
    <section className={styles.inbox} aria-labelledby="inbox-title">
      <div className={styles.inboxHeader}>
        <div>
          <p className={styles.sectionEyebrow}>LOCAL UI PREVIEW</p>
          <h2 id="inbox-title">Request inbox</h2>
          <p>Review the list, empty, loading, and error screen states.</p>
        </div>
        <div className={styles.inboxActions}>
          <Link className={styles.composerLink} href="/quotations/new-request">
            Preview intake form <span aria-hidden="true">→</span>
          </Link>
          <span className={styles.sampleCount}>
            {requests.length} sample requests
          </span>
        </div>
      </div>

      <div className={styles.stateControl}>
        <label htmlFor="preview-state">Preview screen state</label>
        <select
          id="preview-state"
          onChange={(event) => {
            setPreviewState(event.target.value as PreviewState);
            setQuery("");
          }}
          value={previewState}
        >
          <option value="samples">Sample requests</option>
          <option value="empty">Empty inbox</option>
          <option value="loading">Loading preview</option>
          <option value="error">Error preview</option>
        </select>
        <span>State previews are local and do not make network requests.</span>
      </div>

      {previewState === "samples" && (
        <>
          <label className={styles.searchLabel} htmlFor="request-search">
            Search sample requests
          </label>
          <div className={styles.searchRow}>
            <span aria-hidden="true">⌕</span>
            <input
              autoComplete="off"
              id="request-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Company, contact, or request text"
              type="search"
              value={query}
            />
            {query && (
              <button onClick={() => setQuery("")} type="button">
                Clear
              </button>
            )}
          </div>
          <p className={styles.resultSummary} role="status" aria-live="polite">
            Showing {filteredRequests.length} of {requests.length} sample
            {requests.length === 1 ? " request" : " requests"}
          </p>

          {filteredRequests.length > 0 ? (
            <ul className={styles.requestList}>
              {filteredRequests.map((request) => (
                <li key={request.id}>
                  <Link
                    className={styles.requestRow}
                    href={`/quotations/requests/${request.id}`}
                  >
                    <span className={styles.requestMark} aria-hidden="true">
                      Q
                    </span>
                    <span className={styles.requestMain}>
                      <span className={styles.requestTag}>
                        Synthetic request
                      </span>
                      <strong>{request.companyName}</strong>
                      <span className={styles.messagePreview}>
                        {request.message}
                      </span>
                    </span>
                    <span className={styles.requestContact}>
                      <strong>{request.contactName}</strong>
                      <span>{request.email}</span>
                    </span>
                    <span className={styles.rowAction}>
                      View sample <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptyState}>
              <h3>No sample requests match</h3>
              <p>Try another company, contact, or request phrase.</p>
              <button onClick={() => setQuery("")} type="button">
                Clear search
              </button>
            </div>
          )}
        </>
      )}

      {previewState === "empty" && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">
            ◷
          </span>
          <h3>No requests to show</h3>
          <p>
            This is a preview of the empty inbox. No live request data is
            connected.
          </p>
        </div>
      )}

      {previewState === "loading" && (
        <div className={styles.statePanel} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <h3>Loading request preview</h3>
          <p>Loading state preview only; no request has been made.</p>
        </div>
      )}

      {previewState === "error" && (
        <div className={styles.errorPanel} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            !
          </span>
          <div>
            <h3>Requests could not be loaded</h3>
            <p>
              This is a visual error-state preview. The API is not connected and
              no network request was made.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
