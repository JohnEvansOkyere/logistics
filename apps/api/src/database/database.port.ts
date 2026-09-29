export interface DatabaseHealth {
  status: "ok" | "error";
  provider: "sqlite" | "postgresql";
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
