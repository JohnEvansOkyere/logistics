"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { documentTypeLabels } from "@bjh/contracts";
import type {
  DocumentType,
  JobStatus,
  PartyRole,
  ReferenceKind,
} from "@bjh/contracts";
import { useStaffAccess } from "../auth/useStaffAccess";
import {
  addParty,
  addReference,
  changeStatus,
  getDownloadLink,
  getStatusHistory,
  getTimeline,
  listDocuments,
  listParties,
  listReferences,
  recordMilestone,
  removeParty,
  removeReference,
  serviceLineLabels,
  statusLabels,
  uploadDocument,
} from "./jobApi";
import type {
  JobDocument,
  Party,
  Reference,
  StatusHistory,
  Timeline,
} from "./jobApi";
import { JobCharges } from "./JobCharges";
import { JobDeliveries } from "./JobDeliveries";
import { JobCorrespondence } from "./JobCorrespondence";
import { JobEta } from "./JobEta";
import { JobExtractions } from "./JobExtractions";
import { JobInvoices } from "./JobInvoices";
import { JobMessages } from "./JobMessages";
import { JobStock } from "./JobStock";
import { JobTransportDocuments } from "./JobTransportDocuments";
import { JobTasks } from "./JobTasks";
import styles from "./jobs.module.css";

const partyRoles: Array<[PartyRole, string]> = [
  ["shipper", "Shipper"],
  ["consignee", "Consignee"],
  ["notify_party", "Notify party"],
  ["agent", "Agent"],
];
const referenceLabels: Record<ReferenceKind, string> = {
  master_bl: "Master B/L",
  house_bl: "House B/L",
  master_awb: "Master AWB",
  house_awb: "House AWB",
  booking: "Booking",
  container: "Container",
};
const seaKinds: ReferenceKind[] = [
  "master_bl",
  "house_bl",
  "booking",
  "container",
];
const airKinds: ReferenceKind[] = ["master_awb", "house_awb", "booking"];
const parentKinds: Partial<Record<ReferenceKind, ReferenceKind>> = {
  house_bl: "master_bl",
  house_awb: "master_awb",
};

type Data = {
  timeline: Timeline;
  status: StatusHistory;
  parties: Party[];
  references: Reference[];
  documents: JobDocument[];
};

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function JobDetail({ jobId }: { jobId: string }) {
  const { roles } = useStaffAccess();
  const isStaff = roles.length > 0;
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [milestoneKey, setMilestoneKey] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [note, setNote] = useState("");
  const [partyRole, setPartyRole] = useState<PartyRole>("consignee");
  const [partyName, setPartyName] = useState("");
  const [partyDetails, setPartyDetails] = useState("");
  const [kind, setKind] = useState<ReferenceKind>("booking");
  const [value, setValue] = useState("");
  const [seal, setSeal] = useState("");
  const [parentId, setParentId] = useState("");
  const [docType, setDocType] = useState<DocumentType>("other");
  const [docTarget, setDocTarget] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const [timeline, status, parties, references, documents] =
        await Promise.all([
          getTimeline(jobId),
          getStatusHistory(jobId),
          listParties(jobId),
          listReferences(jobId),
          listDocuments(jobId),
        ]);
      setData({ timeline, status, parties, references, documents });
      setLoadError("");
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "The job could not be loaded",
      );
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setError("");
    try {
      await action();
      after?.();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    }
  }

  if (loadError) {
    return (
      <main className={styles.page}>
        <Link className={styles.link} href="/jobs">
          ← Jobs
        </Link>
        <p className={styles.error} role="alert">
          {loadError}
        </p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className={styles.page}>
        <p role="status">Loading job…</p>
      </main>
    );
  }

  const { job } = data.timeline;
  const closedJob = job.status === "closed" || job.status === "cancelled";
  const kinds = job.serviceLine.startsWith("sea") ? seaKinds : airKinds;
  const parentKind = parentKinds[kind];
  const parentChoices = data.references.filter(
    (reference) => reference.kind === parentKind,
  );
  const latestByKey = new Map<string, string>();
  for (const event of data.timeline.events) {
    latestByKey.set(event.milestoneKey, event.occurredAt);
  }
  const labelFor = (key: string) =>
    data.timeline.template.find((item) => item.key === key)?.label ?? key;

  return (
    <main className={styles.page}>
      <Link className={styles.link} href="/jobs">
        ← Jobs
      </Link>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {serviceLineLabels[job.serviceLine].toUpperCase()}
          </p>
          <h1 className={styles.title}>{job.fileNumber}</h1>
          <p className={styles.muted}>
            {job.customerCompanyName} · opened {formatDate(job.openedAt)}
          </p>
        </div>
        <span className={styles.badge}>{statusLabels[job.status]}</span>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {isStaff && (
        <section className={styles.card} aria-labelledby="status-title">
          <h2 id="status-title">Status</h2>
          <div className={styles.actions}>
            {data.status.allowedNext.map((next: JobStatus) => (
              <button
                className={styles.secondaryButton}
                key={next}
                onClick={() =>
                  void run(
                    () =>
                      changeStatus(job.id, {
                        status: next,
                        reason: reason.trim() || undefined,
                      }),
                    () => setReason(""),
                  )
                }
                type="button"
              >
                {closedJob ? "Reopen" : `Move to ${statusLabels[next]}`}
              </button>
            ))}
          </div>
          <div className={styles.form}>
            <label className={styles.field}>
              Reason (required to cancel, reopen or override closure)
              <input
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </label>
          </div>
        </section>
      )}

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="timeline-title">
          <h2 id="timeline-title">Milestones</h2>
          <ol className={styles.timeline}>
            {data.timeline.template.map((item) => (
              <li
                className={latestByKey.has(item.key) ? styles.done : ""}
                key={item.key}
              >
                <strong>{item.label}</strong>
                <span className={styles.muted}>
                  {latestByKey.has(item.key)
                    ? formatDate(latestByKey.get(item.key)!)
                    : "Not recorded"}
                </span>
              </li>
            ))}
          </ol>
          {data.timeline.events.length > 0 && (
            <>
              <h2 style={{ marginTop: 16 }}>Recorded events</h2>
              <ul className={styles.list}>
                {data.timeline.events.map((event) => (
                  <li key={event.id}>
                    {labelFor(event.milestoneKey)} ·{" "}
                    {formatDate(event.occurredAt)}
                    {event.correctionOf ? " (correction)" : ""}
                    {event.note ? ` — ${event.note}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
          {isStaff && !closedJob && (
            <form
              className={styles.form}
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () =>
                    recordMilestone(job.id, {
                      milestoneKey,
                      occurredAt: occurredAt
                        ? new Date(occurredAt).toISOString()
                        : undefined,
                      note: note.trim() || undefined,
                    }),
                  () => {
                    setNote("");
                    setOccurredAt("");
                  },
                );
              }}
            >
              <label className={styles.field}>
                Milestone
                <select
                  onChange={(event) => setMilestoneKey(event.target.value)}
                  required
                  value={milestoneKey}
                >
                  <option value="">Select a milestone</option>
                  {data.timeline.template.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                When it happened (optional)
                <input
                  onChange={(event) => setOccurredAt(event.target.value)}
                  type="datetime-local"
                  value={occurredAt}
                />
              </label>
              <label className={styles.field}>
                Note (a correction is recorded as a new event)
                <input
                  onChange={(event) => setNote(event.target.value)}
                  value={note}
                />
              </label>
              <button className={styles.button} type="submit">
                Record milestone
              </button>
            </form>
          )}
        </section>

        <div>
          <section className={styles.card} aria-labelledby="parties-title">
            <h2 id="parties-title">Parties</h2>
            {data.parties.length === 0 ? (
              <p className={styles.muted}>No parties recorded.</p>
            ) : (
              <ul className={styles.list}>
                {data.parties.map((party) => (
                  <li key={party.id}>
                    <strong>
                      {partyRoles.find(([key]) => key === party.role)?.[1]}
                    </strong>
                    : {party.name}
                    {party.details ? ` — ${party.details}` : ""}{" "}
                    {isStaff && !closedJob && (
                      <button
                        className={styles.secondaryButton}
                        onClick={() =>
                          void run(() => removeParty(job.id, party.id))
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isStaff && !closedJob && (
              <form
                className={styles.form}
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void run(
                    () =>
                      addParty(job.id, {
                        role: partyRole,
                        name: partyName,
                        details: partyDetails.trim() || undefined,
                      }),
                    () => {
                      setPartyName("");
                      setPartyDetails("");
                    },
                  );
                }}
              >
                <label className={styles.field}>
                  Role
                  <select
                    onChange={(event) =>
                      setPartyRole(event.target.value as PartyRole)
                    }
                    value={partyRole}
                  >
                    {partyRoles.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  Name
                  <input
                    onChange={(event) => setPartyName(event.target.value)}
                    required
                    value={partyName}
                  />
                </label>
                <label className={styles.field}>
                  Details (optional)
                  <input
                    onChange={(event) => setPartyDetails(event.target.value)}
                    value={partyDetails}
                  />
                </label>
                <button className={styles.button} type="submit">
                  Add party
                </button>
              </form>
            )}
          </section>

          <section className={styles.card} aria-labelledby="references-title">
            <h2 id="references-title">Shipment references</h2>
            {data.references.length === 0 ? (
              <p className={styles.muted}>No references recorded.</p>
            ) : (
              <ul className={styles.list}>
                {data.references
                  .filter((reference) => !reference.parentReferenceId)
                  .flatMap((reference) => [
                    reference,
                    ...data.references.filter(
                      (child) => child.parentReferenceId === reference.id,
                    ),
                  ])
                  .map((reference) => (
                    <li
                      key={reference.id}
                      style={
                        reference.parentReferenceId
                          ? { marginLeft: 18 }
                          : undefined
                      }
                    >
                      <strong>{referenceLabels[reference.kind]}</strong>:{" "}
                      {reference.value}
                      {reference.sealNumber
                        ? ` (seal ${reference.sealNumber})`
                        : ""}{" "}
                      {isStaff && !closedJob && (
                        <button
                          className={styles.secondaryButton}
                          onClick={() =>
                            void run(() =>
                              removeReference(job.id, reference.id),
                            )
                          }
                          type="button"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            )}
            {isStaff && !closedJob && (
              <form
                className={styles.form}
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void run(
                    () =>
                      addReference(job.id, {
                        kind,
                        value,
                        sealNumber: seal.trim() || undefined,
                        parentReferenceId: parentId || undefined,
                      }),
                    () => {
                      setValue("");
                      setSeal("");
                    },
                  );
                }}
              >
                <label className={styles.field}>
                  Type
                  <select
                    onChange={(event) => {
                      setKind(event.target.value as ReferenceKind);
                      setParentId("");
                    }}
                    value={kind}
                  >
                    {kinds.map((key) => (
                      <option key={key} value={key}>
                        {referenceLabels[key]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  Number
                  <input
                    onChange={(event) => setValue(event.target.value)}
                    required
                    value={value}
                  />
                </label>
                {kind === "container" && (
                  <label className={styles.field}>
                    Seal number (optional)
                    <input
                      onChange={(event) => setSeal(event.target.value)}
                      value={seal}
                    />
                  </label>
                )}
                {parentKind && (
                  <label className={styles.field}>
                    Under master
                    <select
                      onChange={(event) => setParentId(event.target.value)}
                      required
                      value={parentId}
                    >
                      <option value="">Select the master</option>
                      {parentChoices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.value}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button className={styles.button} type="submit">
                  Add reference
                </button>
              </form>
            )}
          </section>
        </div>
      </div>

      <JobEta canEdit={isStaff && !closedJob} jobId={job.id} />
      {isStaff && <JobTasks canEdit={!closedJob} jobId={job.id} />}
      {isStaff && (
        <JobCharges
          canEdit={!closedJob}
          documents={data.documents}
          jobId={job.id}
          quoteId={job.quoteId}
        />
      )}

      {job.serviceLine === "warehousing" && (
        <JobStock canEdit={isStaff && !closedJob} jobId={job.id} />
      )}

      <JobDeliveries
        canEdit={isStaff && !closedJob}
        documents={data.documents}
        jobId={job.id}
      />

      <JobTransportDocuments
        canEdit={!closedJob}
        isStaff={isStaff}
        jobId={job.id}
        serviceLine={job.serviceLine}
      />

      <JobInvoices
        canEdit={!closedJob}
        documents={data.documents}
        isStaff={isStaff}
        jobId={job.id}
      />

      {isStaff && (
        <JobExtractions
          canEdit={!closedJob}
          documents={data.documents}
          jobId={job.id}
          onApplied={() => void load()}
        />
      )}

      {isStaff && <JobMessages jobId={job.id} />}

      {isStaff && (
        <JobCorrespondence documents={data.documents} jobId={job.id} />
      )}

      <section className={styles.card} aria-labelledby="documents-title">
        <h2 id="documents-title">Documents</h2>
        {data.documents.length === 0 ? (
          <p className={styles.muted}>No documents uploaded.</p>
        ) : (
          <ul className={styles.list}>
            {data.documents.map((document) => (
              <li key={document.id}>
                <strong>{documentTypeLabels[document.documentType]}</strong>
                <ul className={styles.list}>
                  {document.versions.map((version) => (
                    <li key={version.versionNumber}>
                      v{version.versionNumber} · {version.filename} ·{" "}
                      {formatSize(version.sizeBytes)} ·{" "}
                      {formatDate(version.uploadedAt)}{" "}
                      <button
                        className={styles.secondaryButton}
                        onClick={() =>
                          void run(async () => {
                            const link = await getDownloadLink(
                              job.id,
                              document.id,
                              version.versionNumber,
                            );
                            window.open(link.url, "_blank", "noopener");
                          })
                        }
                        type="button"
                      >
                        Download
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {isStaff && (
          <form
            className={styles.form}
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (!docFile) return;
              const existing = data.documents.find(
                (document) => document.id === docTarget,
              );
              void run(
                () =>
                  uploadDocument(job.id, {
                    file: docFile,
                    documentType: existing?.documentType ?? docType,
                    documentId: existing?.id,
                  }),
                () => {
                  setDocFile(null);
                  setDocTarget("");
                  setFileInputKey((current) => current + 1);
                },
              );
            }}
          >
            <label className={styles.field}>
              Add as
              <select
                onChange={(event) => setDocTarget(event.target.value)}
                value={docTarget}
              >
                <option value="">A new document</option>
                {data.documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    New version of {documentTypeLabels[document.documentType]} (
                    {document.versions[document.versions.length - 1].filename})
                  </option>
                ))}
              </select>
            </label>
            {!docTarget && (
              <label className={styles.field}>
                Document type
                <select
                  onChange={(event) =>
                    setDocType(event.target.value as DocumentType)
                  }
                  required
                  value={docType}
                >
                  {(Object.keys(documentTypeLabels) as DocumentType[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {documentTypeLabels[key]}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}
            <label className={styles.field}>
              File (PDF, PNG or JPEG, up to 25 MB)
              <input
                accept="application/pdf,image/png,image/jpeg"
                key={fileInputKey}
                onChange={(event) =>
                  setDocFile(event.target.files?.[0] ?? null)
                }
                required
                type="file"
              />
            </label>
            <button className={styles.button} type="submit">
              Upload document
            </button>
          </form>
        )}
      </section>

      <section className={styles.card} aria-labelledby="history-title">
        <h2 id="history-title">Status history</h2>
        {data.status.history.length === 0 ? (
          <p className={styles.muted}>No status changes yet.</p>
        ) : (
          <ul className={styles.list}>
            {data.status.history.map((entry) => (
              <li key={entry.id}>
                {statusLabels[entry.fromStatus]} →{" "}
                {statusLabels[entry.toStatus]} · {formatDate(entry.changedAt)}
                {entry.reason ? ` — ${entry.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
