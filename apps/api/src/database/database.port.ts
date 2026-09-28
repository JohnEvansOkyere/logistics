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

export abstract class DatabasePort {
  abstract healthCheck(): Promise<DatabaseHealth>;
  abstract createQuoteRequest(
    request: QuoteRequestRecord,
  ): Promise<QuoteRequestRecord>;
  abstract listQuoteRequests(): Promise<QuoteRequestRecord[]>;
  abstract findQuoteRequest(id: string): Promise<QuoteRequestRecord | null>;
}
