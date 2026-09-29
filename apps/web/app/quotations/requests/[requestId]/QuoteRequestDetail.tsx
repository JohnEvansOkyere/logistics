"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { listCustomers } from "../../../customers/customerApi";
import type { CustomerCompany } from "../../../customers/customerApi";
import { useStaffAccess } from "../../../auth/useStaffAccess";
import {
  associateQuoteRequestCustomer,
  assignQuoteRequestDepartment,
  getQuoteDraft,
  getQuoteRequestAssignment,
  getQuoteRequest,
  saveQuoteDraft,
} from "../../quoteRequestApi";
import type {
  DepartmentRoleKey,
  QuoteDraft,
  QuoteRequest,
} from "../../quoteRequestApi";
import styles from "../../quotation.module.css";

type LoadState = "loading" | "ready" | "error";

export function QuoteRequestDetail() {
  const staffAccess = useStaffAccess();
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [customers, setCustomers] = useState<CustomerCompany[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [customerLoadError, setCustomerLoadError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linking, setLinking] = useState(false);
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [draftState, setDraftState] = useState<LoadState>("loading");
  const [draftError, setDraftError] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [assignedRole, setAssignedRole] = useState<DepartmentRoleKey | null>(
    null,
  );
  const [selectedRole, setSelectedRole] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    getQuoteRequest(requestId)
      .then((result) => {
        if (active) {
          setRequest(result);
          setLoadState("ready");
          if (result.customerCompanyId) {
            if (staffAccess.status === "loading") return;
            if (staffAccess.status === "unavailable") {
              setDraftError("Staff access could not be checked.");
              setDraftState("error");
              return;
            }
            setDraftState("loading");
            getQuoteDraft(requestId)
              .then((savedDraft) => {
                if (active) {
                  setDraft(savedDraft);
                  setDraftContent(savedDraft?.content ?? "");
                  setDraftState("ready");
                }
              })
              .catch((cause: unknown) => {
                if (active) {
                  setDraftError(
                    cause instanceof Error
                      ? cause.message
                      : "The quote draft could not be loaded",
                  );
                  setDraftState("error");
                }
              });
          } else {
            setDraft(null);
            setDraftContent("");
            setDraftState("ready");
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The request could not be loaded",
          );
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [requestId, staffAccess.isDepartmentStaff, staffAccess.status]);

  useEffect(() => {
    if (staffAccess.status !== "ready" || !staffAccess.roles.length) return;
    getQuoteRequestAssignment(requestId)
      .then((role) => {
        setAssignedRole(role);
        setSelectedRole(role ?? "");
      })
      .catch((cause: unknown) => {
        setAssignmentError(
          cause instanceof Error
            ? cause.message
            : "Assignment could not be loaded",
        );
      });
  }, [requestId, staffAccess.roles.length, staffAccess.status]);

  useEffect(() => {
    let active = true;
    listCustomers("")
      .then((results) => {
        if (active) {
          setCustomers(results);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setCustomerLoadError(
            cause instanceof Error
              ? cause.message
              : "Customer records could not be loaded",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function linkCustomer() {
    if (!selectedCustomerId || linking) {
      return;
    }

    setLinking(true);
    setLinkError("");
    try {
      const linkedRequest = await associateQuoteRequestCustomer(
        requestId,
        selectedCustomerId,
      );
      setRequest(linkedRequest);
      setDraftState("loading");
      try {
        const savedDraft = await getQuoteDraft(requestId);
        setDraft(savedDraft);
        setDraftContent(savedDraft?.content ?? "");
        setDraftState("ready");
      } catch (cause) {
        setDraftError(
          cause instanceof Error
            ? cause.message
            : "The quote draft could not be loaded",
        );
        setDraftState("error");
      }
    } catch (cause) {
      setLinkError(
        cause instanceof Error
          ? cause.message
          : "The request could not be linked to the customer",
      );
    } finally {
      setLinking(false);
    }
  }

  async function saveDraft() {
    if (savingDraft || !draftContent.trim()) {
      return;
    }

    setSavingDraft(true);
    setDraftError("");
    try {
      const savedDraft = await saveQuoteDraft(requestId, draftContent);
      setDraft(savedDraft);
      setDraftContent(savedDraft.content);
      setRequest((current) =>
        current
          ? {
              ...current,
              quoteDraftRevisionCount: savedDraft.revisions.length,
              quoteDraftUpdatedAt: savedDraft.updatedAt,
            }
          : current,
      );
    } catch (cause) {
      setDraftError(
        cause instanceof Error
          ? cause.message
          : "The quote draft could not be saved",
      );
    } finally {
      setSavingDraft(false);
    }
  }

  async function saveAssignment() {
    if (savingAssignment) return;
    setSavingAssignment(true);
    setAssignmentError("");
    try {
      const role = selectedRole ? (selectedRole as DepartmentRoleKey) : null;
      await assignQuoteRequestDepartment(requestId, role);
      setAssignedRole(role);
      if (!role) {
        setDraft(null);
        setDraftContent("");
        setDraftState("ready");
      }
    } catch (cause) {
      setAssignmentError(
        cause instanceof Error
          ? cause.message
          : "Assignment could not be saved",
      );
    } finally {
      setSavingAssignment(false);
    }
  }

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/quotations">
        <span aria-hidden="true">←</span> Back to request inbox
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · LOCAL ENGINE</p>
          <h1>Quote request</h1>
          <p className={styles.description}>
            Captured customer details and request message.
          </p>
        </div>
        <span className={styles.localBadge}>LOCAL DEVELOPMENT</span>
      </header>

      {loadState === "loading" && (
        <div className={styles.statePanel} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <h3>Loading request</h3>
        </div>
      )}

      {loadState === "error" && (
        <div className={styles.errorPanel} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            !
          </span>
          <div>
            <h3>Request could not be loaded</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {loadState === "ready" && request && (
        <>
          <article className={styles.requestDetail}>
            <header className={styles.detailHeader}>
              <div>
                <p className={styles.sectionEyebrow}>RECEIVED REQUEST</p>
                <h2>{request.companyName}</h2>
              </div>
              <span className={styles.sampleCount}>Received</span>
            </header>
            <dl className={styles.contactGrid}>
              <div>
                <dt>Contact</dt>
                <dd>{request.contactName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{request.email}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>
                  {new Intl.DateTimeFormat("en-GH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Accra",
                  }).format(new Date(request.createdAt))}
                </dd>
              </div>
            </dl>
            <section
              className={styles.messagePanel}
              aria-labelledby="message-title"
            >
              <h3 id="message-title">Request message</h3>
              <p>{request.message}</p>
            </section>
            {staffAccess.roles.length > 0 && (
              <section
                className={styles.customerLinkPanel}
                aria-labelledby="department-assignment-title"
              >
                <h3 id="department-assignment-title">Department assignment</h3>
                <p>
                  {assignedRole
                    ? `Assigned to ${assignedRole.replaceAll("_", " ")}.`
                    : "Not assigned."}
                </p>
                {staffAccess.isSuperAdmin && (
                  <div className={styles.customerLinkActions}>
                    <label htmlFor="request-department">
                      Assign department
                    </label>
                    <select
                      id="request-department"
                      value={selectedRole}
                      onChange={(event) => setSelectedRole(event.target.value)}
                    >
                      <option value="">Unassigned</option>
                      <option value="air_import_rep">Air import</option>
                      <option value="air_export_rep">Air export</option>
                      <option value="sea_import_rep">Sea import</option>
                      <option value="sea_export_rep">Sea export</option>
                    </select>
                    <button
                      className={styles.secondaryButton}
                      disabled={
                        savingAssignment ||
                        selectedRole === (assignedRole ?? "")
                      }
                      onClick={() => void saveAssignment()}
                      type="button"
                    >
                      {savingAssignment ? "Saving…" : "Save assignment"}
                    </button>
                  </div>
                )}
                {assignmentError && <p role="alert">{assignmentError}</p>}
              </section>
            )}
            <section
              className={styles.customerLinkPanel}
              aria-labelledby="customer-link-title"
            >
              <h3 id="customer-link-title">Customer record</h3>
              {request.customerCompanyId && request.customerCompanyName ? (
                <p>
                  Linked to{" "}
                  <Link href={`/customers/${request.customerCompanyId}`}>
                    {request.customerCompanyName}
                  </Link>
                </p>
              ) : !staffAccess.isSuperAdmin ? (
                <p>
                  Only the super admin can link requests to customer records.
                </p>
              ) : customerLoadError ? (
                <p role="alert">{customerLoadError}</p>
              ) : customers.length === 0 ? (
                <p>
                  Create a customer record before linking this request.{" "}
                  <Link href="/customers/new">Create customer</Link>
                </p>
              ) : (
                <div className={styles.customerLinkActions}>
                  <label htmlFor="request-customer">Link to company</label>
                  <select
                    id="request-customer"
                    onChange={(event) =>
                      setSelectedCustomerId(event.target.value)
                    }
                    value={selectedCustomerId}
                  >
                    <option value="">Choose a customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.companyName}
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.secondaryButton}
                    disabled={!selectedCustomerId || linking}
                    onClick={() => void linkCustomer()}
                    type="button"
                  >
                    {linking ? "Linking…" : "Link customer"}
                  </button>
                </div>
              )}
              {linkError && (
                <p className={styles.customerLinkError} role="alert">
                  {linkError}
                </p>
              )}
            </section>
            <section
              className={styles.customerLinkPanel}
              aria-labelledby="quote-draft-title"
            >
              <h3 id="quote-draft-title">Quote draft</h3>
              {!request.customerCompanyId ? (
                <p>Link this request to a customer record before drafting.</p>
              ) : draftState === "loading" ? (
                <p role="status">Loading quote draft…</p>
              ) : draftState === "error" ? (
                <p role="alert">{draftError}</p>
              ) : (
                <>
                  <label htmlFor="quote-draft-content">Draft content</label>
                  <textarea
                    id="quote-draft-content"
                    maxLength={20000}
                    onChange={(event) => setDraftContent(event.target.value)}
                    readOnly={
                      !staffAccess.isSuperAdmin &&
                      !staffAccess.roles.includes(assignedRole ?? "")
                    }
                    rows={8}
                    value={draftContent}
                  />
                  {(staffAccess.isSuperAdmin ||
                    staffAccess.roles.includes(assignedRole ?? "")) && (
                    <button
                      className={styles.secondaryButton}
                      disabled={!draftContent.trim() || savingDraft}
                      onClick={() => void saveDraft()}
                      type="button"
                    >
                      {savingDraft
                        ? "Saving…"
                        : draft
                          ? "Save new revision"
                          : "Save quote draft"}
                    </button>
                  )}
                  {draftError && <p role="alert">{draftError}</p>}
                  {draft && (
                    <div aria-label="Quote draft revisions">
                      <h4>Saved revisions</h4>
                      <ol>
                        {draft.revisions.map((revision) => (
                          <li key={revision.id}>
                            Revision {revision.revisionNumber} ·{" "}
                            {new Intl.DateTimeFormat("en-GH", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Africa/Accra",
                            }).format(new Date(revision.createdAt))}
                            <details>
                              <summary>View saved content</summary>
                              <p>{revision.content}</p>
                            </details>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <p>
                    Draft only. Saving does not issue or accept a quote or
                    create a job.
                  </p>
                </>
              )}
            </section>
          </article>

          <p className={styles.notIssued}>
            This request has not been priced or issued as a quotation, and no
            job has been created.
          </p>
        </>
      )}
    </main>
  );
}
