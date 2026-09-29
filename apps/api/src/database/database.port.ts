import type {
  BusinessSettings,
  DocumentType,
  QuoteDecision,
  QuoteBasis,
  QuoteVersionInput,
  TaskKind,
  JobStatus,
  PartyRole,
  ReferenceKind,
} from "@bjh/contracts";

export interface DatabaseHealth {
  status: "ok" | "error";
  provider: "postgresql";
  schemaVersion?: string;
}

export interface QuoteRequestRecord {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  message: string;
  createdAt: string;
  customerCompanyId: string | null;
  customerCompanyName: string | null;
  quoteDraftRevisionCount: number;
  quoteDraftUpdatedAt: string | null;
}

export interface QuoteDraftRevisionRecord {
  id: string;
  revisionNumber: number;
  content: string;
  createdAt: string;
  savedBy: string | null;
}

export interface QuoteDraftRecord {
  id: string;
  requestId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  revisions: QuoteDraftRevisionRecord[];
}

export type ServiceLine =
  "sea_import" | "sea_export" | "air_import" | "air_export";

export interface JobStatusChangeRecord {
  id: string;
  jobId: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  reason: string | null;
  changedBy: string;
  changedAt: string;
}

export interface JobPartyRecord {
  id: string;
  jobId: string;
  role: PartyRole;
  name: string;
  details: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ShipmentReferenceRecord {
  id: string;
  jobId: string;
  kind: ReferenceKind;
  value: string;
  sealNumber: string | null;
  parentReferenceId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface DocumentVersionRecord {
  id: string;
  versionNumber: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface DocumentRecord {
  id: string;
  jobId: string;
  documentType: DocumentType;
  createdBy: string;
  createdAt: string;
  versions: DocumentVersionRecord[];
}

/** Internal only: the storage key is never returned to API clients. */
export interface StoredDocumentVersion extends DocumentVersionRecord {
  objectKey: string;
  documentId: string;
}

export interface JobRecord {
  id: string;
  fileNumber: string;
  serviceLine: ServiceLine;
  customerCompanyId: string;
  customerCompanyName: string;
  quoteRequestId: string | null;
  status: JobStatus;
  openedBy: string;
  openedAt: string;
  closedAt: string | null;
}

export interface MilestoneEventRecord {
  id: string;
  jobId: string;
  milestoneKey: string;
  occurredAt: string;
  recordedAt: string;
  recordedBy: string;
  source: "manual" | "system";
  note: string | null;
  correctionOf: string | null;
}

export interface EtaEventRecord {
  id: string;
  jobId: string;
  etaAt: string;
  source: string;
  note: string | null;
  recordedAt: string;
  recordedBy: string;
  correctionOf: string | null;
}

export interface JobTaskRecord {
  id: string;
  jobId: string;
  fileNumber: string;
  customerCompanyName: string;
  kind: TaskKind;
  title: string;
  details: string | null;
  assignedRole: StaffRoleKey;
  dueDate: string | null;
  status: "open" | "done";
  createdAt: string;
  createdBy: string;
  completedAt: string | null;
  completedBy: string | null;
  completionNote: string | null;
}

export interface QuoteLineRecord {
  id: string;
  position: number;
  section: string | null;
  description: string;
  basis: QuoteBasis;
  basisNote: string | null;
  amountMinor: number | null;
  amount20ftMinor: number | null;
  amount40ftMinor: number | null;
}

export interface QuoteVersionRecord {
  id: string;
  versionNumber: number;
  status: "draft" | "issued";
  currency: string;
  title: string;
  subtitle: string | null;
  shipmentScope: string | null;
  intro: string | null;
  atCostNote: string | null;
  procedureSteps: string[];
  requiredDocuments: string[];
  documentsNote: string | null;
  timeline: string | null;
  terms: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  issuedBy: string | null;
  issuedAt: string | null;
  lines: QuoteLineRecord[];
}

/** A quote as listed: the latest version the viewer may see. */
export interface QuoteSummaryRecord {
  id: string;
  quoteNumber: string | null;
  serviceLine: ServiceLine;
  customerCompanyId: string;
  customerCompanyName: string;
  quoteRequestId: string | null;
  createdBy: string;
  createdAt: string;
  latestVersionNumber: number;
  latestStatus: "draft" | "issued";
  title: string;
  currency: string;
}

export interface QuoteDecisionRecord {
  id: string;
  versionNumber: number;
  decision: QuoteDecision;
  clientSignatory: string;
  decidedAt: string;
  note: string | null;
  recordedAt: string;
  recordedBy: string;
}

export interface QuoteRecord extends Omit<
  QuoteSummaryRecord,
  "latestVersionNumber" | "latestStatus" | "title" | "currency"
> {
  versions: QuoteVersionRecord[];
  decisions: QuoteDecisionRecord[];
  /** The job opened when the quote was accepted, if any. */
  jobId: string | null;
}

export interface BusinessSettingsRevisionRecord {
  revisionNumber: number;
  settings: BusinessSettings;
  changedBy: string;
  changedAt: string;
}

export interface ActivityEntry {
  actorUserId: string;
  actorEmail: string | null;
  method: string;
  route: string;
  entityId: string | null;
  statusCode: number;
  clientIp: string | null;
}

export interface ActivityRecord extends ActivityEntry {
  id: string;
  occurredAt: string;
}

export interface ActivityFilter {
  actorUserId?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

/** Undefined fields mean unrestricted; an empty array matches nothing. */
export interface JobScope {
  companyIds?: string[];
  serviceLines?: ServiceLine[];
}

export interface CustomerContactRecord {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CustomerCompanyRecord {
  id: string;
  companyName: string;
  createdAt: string;
  contacts: CustomerContactRecord[];
}

export interface CustomerMembershipRecord {
  id: string;
  companyId: string;
  userId: string;
  grantedBy: string;
  grantedAt: string;
  revokedAt: string | null;
}

export type StaffRoleKey =
  | "super_admin"
  | "air_import_rep"
  | "air_export_rep"
  | "sea_import_rep"
  | "sea_export_rep";

export type DepartmentRoleKey = Exclude<StaffRoleKey, "super_admin">;

export interface StaffRoleAssignmentRecord {
  id: string;
  userId: string;
  roleKey: StaffRoleKey;
  assignedBy: string;
  assignedAt: string;
  revokedAt: string | null;
}

export abstract class DatabasePort {
  abstract healthCheck(): Promise<DatabaseHealth>;
  abstract createQuoteRequest(
    request: QuoteRequestRecord,
  ): Promise<QuoteRequestRecord>;
  abstract listQuoteRequests(
    customerCompanyId?: string,
    allowedCompanyIds?: string[],
  ): Promise<QuoteRequestRecord[]>;
  abstract findQuoteRequest(
    id: string,
    allowedCompanyIds?: string[],
  ): Promise<QuoteRequestRecord | null>;
  abstract linkQuoteRequestToCustomer(
    requestId: string,
    customerCompanyId: string,
  ): Promise<QuoteRequestRecord | null>;
  abstract getQuoteRequestDepartment(
    requestId: string,
  ): Promise<DepartmentRoleKey | null | undefined>;
  abstract assignQuoteRequestDepartment(
    requestId: string,
    roleKey: DepartmentRoleKey | null,
    assignedBy: string,
    assignedAt: string,
  ): Promise<DepartmentRoleKey | null | undefined>;
  abstract findQuoteDraft(requestId: string): Promise<QuoteDraftRecord | null>;
  abstract saveQuoteDraft(
    requestId: string,
    content: string,
    savedBy: string,
    savedAt: string,
  ): Promise<QuoteDraftRecord>;
  abstract createCustomer(
    customer: CustomerCompanyRecord,
  ): Promise<CustomerCompanyRecord>;
  abstract listCustomers(
    search: string,
    companyIds?: string[],
  ): Promise<CustomerCompanyRecord[]>;
  abstract findCustomer(
    id: string,
    companyIds?: string[],
  ): Promise<CustomerCompanyRecord | null>;
  abstract createJob(
    input: {
      customerCompanyId: string;
      serviceLine: ServiceLine;
      quoteRequestId: string | null;
    },
    openedBy: string,
    year: number,
  ): Promise<JobRecord>;
  abstract listJobs(search: string, scope: JobScope): Promise<JobRecord[]>;
  abstract findJob(id: string, scope: JobScope): Promise<JobRecord | null>;
  abstract addJobParty(party: {
    jobId: string;
    role: PartyRole;
    name: string;
    details: string | null;
    createdBy: string;
  }): Promise<JobPartyRecord>;
  abstract listJobParties(jobId: string): Promise<JobPartyRecord[]>;
  abstract removeJobParty(
    jobId: string,
    partyId: string,
    removedBy: string,
  ): Promise<boolean>;
  abstract addShipmentReference(reference: {
    jobId: string;
    kind: ReferenceKind;
    value: string;
    sealNumber: string | null;
    parentReferenceId: string | null;
    createdBy: string;
  }): Promise<
    ShipmentReferenceRecord | "parent_invalid" | "duplicate_reference"
  >;
  abstract listShipmentReferences(
    jobId: string,
  ): Promise<ShipmentReferenceRecord[]>;
  abstract removeShipmentReference(
    jobId: string,
    referenceId: string,
    removedBy: string,
  ): Promise<boolean | "has_children">;
  abstract saveDocumentVersion(upload: {
    jobId: string;
    documentId: string | null;
    documentType: DocumentType;
    filename: string;
    contentType: string;
    sizeBytes: number;
    sha256: string;
    objectKey: string;
    uploadedBy: string;
  }): Promise<DocumentRecord | "document_not_found">;
  abstract listDocuments(jobId: string): Promise<DocumentRecord[]>;
  abstract findDocumentVersion(
    jobId: string,
    documentId: string,
    versionNumber?: number,
  ): Promise<StoredDocumentVersion | null>;
  abstract changeJobStatus(change: {
    jobId: string;
    from: JobStatus;
    to: JobStatus;
    reason: string | null;
    changedBy: string;
  }): Promise<JobRecord | "status_changed">;
  abstract listJobStatusHistory(
    jobId: string,
  ): Promise<JobStatusChangeRecord[]>;
  abstract appendMilestoneEvent(event: {
    jobId: string;
    milestoneKey: string;
    occurredAt: string;
    recordedBy: string;
    note: string | null;
    correctionOf: string | null;
  }): Promise<MilestoneEventRecord | "correction_target_not_found">;
  abstract listMilestoneEvents(jobId: string): Promise<MilestoneEventRecord[]>;
  abstract appendEtaEvent(event: {
    jobId: string;
    etaAt: string;
    source: string;
    note: string | null;
    recordedBy: string;
    correctionOf: string | null;
  }): Promise<EtaEventRecord | "correction_target_not_found">;
  abstract listEtaEvents(jobId: string): Promise<EtaEventRecord[]>;
  abstract createJobTask(task: {
    jobId: string;
    kind: TaskKind;
    title: string;
    details: string | null;
    assignedRole: StaffRoleKey;
    dueDate: string | null;
    createdBy: string;
  }): Promise<JobTaskRecord>;
  abstract listJobTasks(
    filter: { jobId?: string; assignedRole?: StaffRoleKey; open?: boolean },
    scope: JobScope,
  ): Promise<JobTaskRecord[]>;
  abstract completeJobTask(
    jobId: string,
    taskId: string,
    completedBy: string,
    note: string | null,
  ): Promise<JobTaskRecord | "not_found" | "already_done">;
  abstract createQuote(
    input: {
      customerCompanyId: string;
      serviceLine: ServiceLine;
      quoteRequestId: string | null;
      version: QuoteVersionInput;
    },
    createdBy: string,
  ): Promise<string>;
  abstract listQuotes(scope: JobScope): Promise<QuoteSummaryRecord[]>;
  /** Customers (a scope with company IDs) only ever see issued versions. */
  abstract findQuote(id: string, scope: JobScope): Promise<QuoteRecord | null>;
  abstract saveQuoteVersionDraft(
    quoteId: string,
    content: QuoteVersionInput,
  ): Promise<"saved" | "no_draft">;
  abstract startQuoteVersion(
    quoteId: string,
    createdBy: string,
  ): Promise<"started" | "draft_exists">;
  abstract issueQuoteVersion(
    quoteId: string,
    issuedBy: string,
    year: number,
  ): Promise<"issued" | "no_draft" | "no_lines">;
  /**
   * Records the client's decision on the latest issued version. Accepting also
   * opens the job in the same transaction. Repeating the same decision returns
   * the stored one (and its job) instead of creating another.
   */
  abstract decideQuote(input: {
    quoteId: string;
    versionNumber: number;
    decision: QuoteDecision;
    clientSignatory: string;
    decidedAt: string;
    note: string | null;
    recordedBy: string;
    year: number;
  }): Promise<
    | { decision: QuoteDecisionRecord; job: JobRecord | null }
    | "version_not_found"
    | "not_issued"
    | "not_latest"
    | "already_decided"
  >;
  abstract getBusinessSettings(): Promise<BusinessSettingsRevisionRecord | null>;
  abstract listBusinessSettingsRevisions(): Promise<
    BusinessSettingsRevisionRecord[]
  >;
  abstract saveBusinessSettings(
    settings: BusinessSettings,
    changedBy: string,
  ): Promise<BusinessSettingsRevisionRecord>;
  abstract recordActivity(entry: ActivityEntry): Promise<void>;
  abstract listActivity(filter: ActivityFilter): Promise<ActivityRecord[]>;
  abstract getActiveCustomerCompanyIds(userId: string): Promise<string[]>;
  abstract listCustomerMemberships(
    userId: string,
  ): Promise<CustomerMembershipRecord[]>;
  abstract grantCustomerMembership(
    companyId: string,
    userId: string,
    grantedBy: string,
  ): Promise<CustomerMembershipRecord | "already_active">;
  abstract revokeCustomerMembership(
    companyId: string,
    userId: string,
    revokedBy: string,
  ): Promise<boolean>;
  abstract hasActiveSuperAdmin(): Promise<boolean>;
  abstract claimInitialSuperAdmin(userId: string): Promise<boolean>;
  abstract getActiveStaffRoles(userId: string): Promise<StaffRoleKey[]>;
  abstract listStaffRoleAssignments(): Promise<StaffRoleAssignmentRecord[]>;
  abstract assignStaffRole(
    userId: string,
    roleKey: StaffRoleKey,
    assignedBy: string,
  ): Promise<
    StaffRoleAssignmentRecord | "super_admin_exists" | "already_active"
  >;
  abstract revokeStaffRole(
    userId: string,
    roleKey: StaffRoleKey,
    revokedBy: string,
  ): Promise<"revoked" | "not_found" | "last_super_admin">;
}
