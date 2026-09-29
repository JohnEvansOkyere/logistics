import type { JobStatus } from "@bjh/contracts";

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
