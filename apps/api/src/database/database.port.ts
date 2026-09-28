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

export type StaffRoleKey =
  | "super_admin"
  | "air_import_rep"
  | "air_export_rep"
  | "sea_import_rep"
  | "sea_export_rep";

export abstract class DatabasePort {
  abstract healthCheck(): Promise<DatabaseHealth>;
  abstract createQuoteRequest(
    request: QuoteRequestRecord,
  ): Promise<QuoteRequestRecord>;
  abstract listQuoteRequests(
    customerCompanyId?: string,
  ): Promise<QuoteRequestRecord[]>;
  abstract findQuoteRequest(id: string): Promise<QuoteRequestRecord | null>;
  abstract linkQuoteRequestToCustomer(
    requestId: string,
    customerCompanyId: string,
  ): Promise<QuoteRequestRecord | null>;
  abstract createCustomer(
    customer: CustomerCompanyRecord,
  ): Promise<CustomerCompanyRecord>;
  abstract listCustomers(search: string): Promise<CustomerCompanyRecord[]>;
  abstract findCustomer(id: string): Promise<CustomerCompanyRecord | null>;
  abstract hasActiveSuperAdmin(): Promise<boolean>;
  abstract claimInitialSuperAdmin(userId: string): Promise<boolean>;
  abstract getActiveStaffRoles(userId: string): Promise<StaffRoleKey[]>;
}
