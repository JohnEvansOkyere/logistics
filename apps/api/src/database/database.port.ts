export interface DatabaseHealth {
  status: "ok" | "error";
  provider: "sqlite" | "postgresql";
  schemaVersion?: string;
}

export abstract class DatabasePort {
  abstract healthCheck(): Promise<DatabaseHealth>;
}
