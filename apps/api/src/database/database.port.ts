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

export abstract class DatabasePort {
  abstract healthCheck(): Promise<DatabaseHealth>;
  abstract createQuoteRequest(
    request: QuoteRequestRecord,
  ): Promise<QuoteRequestRecord>;
  abstract listQuoteRequests(): Promise<QuoteRequestRecord[]>;
  abstract findQuoteRequest(id: string): Promise<QuoteRequestRecord | null>;
  abstract createCustomer(
    customer: CustomerCompanyRecord,
  ): Promise<CustomerCompanyRecord>;
  abstract listCustomers(search: string): Promise<CustomerCompanyRecord[]>;
  abstract findCustomer(id: string): Promise<CustomerCompanyRecord | null>;
}
