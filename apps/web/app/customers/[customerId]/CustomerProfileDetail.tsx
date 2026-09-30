"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useStaffAccess } from "../../auth/useStaffAccess";
import { addContact, getCustomer, updateContact } from "../customerApi";
import type { CustomerCompany } from "../customerApi";
import { listQuoteRequests } from "../../quotations/quoteRequestApi";
import type { QuoteRequest } from "../../quotations/quoteRequestApi";
import styles from "./customerProfile.module.css";

type LoadState = "loading" | "ready" | "error";

export function CustomerProfileDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<CustomerCompany | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [historyState, setHistoryState] = useState<LoadState>("loading");
  const [historyError, setHistoryError] = useState("");
  const { isSuperAdmin } = useStaffAccess();
  const [contactError, setContactError] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  async function changeContact(
    contactId: string,
    update: { phone: string; notify: boolean },
  ) {
    setContactError("");
    try {
      await updateContact(customerId, contactId, update);
      setCustomer(await getCustomer(customerId));
    } catch (cause) {
      setContactError(
        cause instanceof Error
          ? cause.message
          : "The contact could not be saved",
      );
    }
  }

  async function submitContact(event: React.FormEvent) {
    event.preventDefault();
    setContactError("");
    try {
      await addContact(customerId, {
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim() || undefined,
      });
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setCustomer(await getCustomer(customerId));
    } catch (cause) {
      setContactError(
        cause instanceof Error
          ? cause.message
          : "The contact could not be added",
      );
    }
  }

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    getCustomer(customerId)
      .then((result) => {
        if (active) {
          setCustomer(result);
          setLoadState("ready");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The customer could not be loaded",
          );
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [customerId]);

  useEffect(() => {
    let active = true;
    setHistoryState("loading");
    listQuoteRequests(customerId)
      .then((results) => {
        if (active) {
          setQuoteRequests(results);
          setHistoryState("ready");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setHistoryError(
            cause instanceof Error
              ? cause.message
              : "Customer history could not be loaded",
          );
          setHistoryState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [customerId]);

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/customers">
        <span aria-hidden="true">←</span> Back to customers
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>STAFF WORKSPACE · LOCAL ENGINE</p>
          <h1>{customer?.companyName ?? "Customer profile"}</h1>
          <p className={styles.description}>
            Saved company and contact details.
          </p>
        </div>
        <span className={styles.sampleBadge}>LOCAL RECORD</span>
      </header>

      {loadState === "loading" && (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <h2>Loading customer</h2>
        </div>
      )}

      {loadState === "error" && (
        <div className={styles.emptyState} role="alert">
          <h2>Customer could not be loaded</h2>
          <p>{error}</p>
        </div>
      )}

      {loadState === "ready" && customer && (
        <>
          <section
            className={styles.contactCard}
            aria-labelledby="contact-title"
          >
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.sectionEyebrow}>PROFILE</p>
                <h2 id="contact-title">Contacts</h2>
              </div>
              <span className={styles.notConnected}>Local data</span>
            </div>
            <dl className={styles.contactGrid}>
              {customer.contacts.map((contact) => (
                <div key={contact.id}>
                  <dt>{contact.name}</dt>
                  <dd>{contact.email}</dd>
                  <dd>{contact.phone ?? "No phone number"}</dd>
                  <dd>
                    {contact.notify
                      ? "Receives customer messages"
                      : "Messages switched off"}
                  </dd>
                  {isSuperAdmin && (
                    <dd>
                      <button
                        onClick={() =>
                          void changeContact(contact.id, {
                            phone: contact.phone ?? "",
                            notify: !contact.notify,
                          })
                        }
                        type="button"
                      >
                        {contact.notify
                          ? "Switch messages off"
                          : "Switch messages on"}
                      </button>{" "}
                      <button
                        onClick={() => {
                          const phone = window.prompt(
                            "Phone number for SMS (leave empty to remove)",
                            contact.phone ?? "",
                          );
                          if (phone !== null) {
                            void changeContact(contact.id, {
                              phone,
                              notify: contact.notify,
                            });
                          }
                        }}
                        type="button"
                      >
                        Change phone
                      </button>
                    </dd>
                  )}
                </div>
              ))}
            </dl>
            {contactError && <p role="alert">{contactError}</p>}
            {isSuperAdmin && (
              <form onSubmit={submitContact}>
                <h3>Add a contact</h3>
                <label>
                  Name{" "}
                  <input
                    maxLength={160}
                    onChange={(event) => setNewName(event.target.value)}
                    required
                    value={newName}
                  />
                </label>{" "}
                <label>
                  Email{" "}
                  <input
                    maxLength={254}
                    onChange={(event) => setNewEmail(event.target.value)}
                    required
                    type="email"
                    value={newEmail}
                  />
                </label>{" "}
                <label>
                  Phone (optional){" "}
                  <input
                    maxLength={40}
                    onChange={(event) => setNewPhone(event.target.value)}
                    type="tel"
                    value={newPhone}
                  />
                </label>{" "}
                <button type="submit">Add contact</button>
              </form>
            )}
          </section>

          <section
            className={styles.historySection}
            aria-labelledby="history-title"
          >
            <div className={styles.historyHeading}>
              <div>
                <p className={styles.sectionEyebrow}>ACTIVITY</p>
                <h2 id="history-title">Customer history</h2>
              </div>
              <span className={styles.localCaption}>LOCAL ENGINE</span>
            </div>
            <div className={styles.historyGrid}>
              <article className={styles.historyCard}>
                <div className={styles.cardHeading}>
                  <h3>Quote requests</h3>
                  <span className={styles.notConnected}>
                    {quoteRequests.length}
                  </span>
                </div>
                {historyState === "loading" ? (
                  <p>Loading linked requests…</p>
                ) : historyState === "error" ? (
                  <p role="alert">{historyError}</p>
                ) : quoteRequests.length > 0 ? (
                  <ul className={styles.historyList}>
                    {quoteRequests.map((request) => (
                      <li key={request.id}>
                        <Link
                          className={styles.historyLink}
                          href={`/quotations/requests/${request.id}`}
                        >
                          {request.message}
                        </Link>
                        <p>
                          {request.quoteDraftRevisionCount > 0
                            ? `Quote draft · ${request.quoteDraftRevisionCount} ${request.quoteDraftRevisionCount === 1 ? "revision" : "revisions"}`
                            : "No quote draft saved"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No quote requests are linked to this company.</p>
                )}
              </article>
              <article className={styles.historyCard}>
                <div className={styles.cardHeading}>
                  <h3>Jobs</h3>
                  <span className={styles.notConnected}>Not connected</span>
                </div>
                <p>Job records have not been implemented yet.</p>
              </article>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
