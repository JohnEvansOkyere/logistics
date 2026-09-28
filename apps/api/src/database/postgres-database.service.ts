import {
  Inject,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  DatabaseHealth,
  DatabasePort,
  CustomerCompanyRecord,
  QuoteRequestRecord,
} from "./database.port";

export const POSTGRES_POOL = Symbol("POSTGRES_POOL");

export interface PostgresPool {
  query(queryText: string): Promise<unknown>;
  end(): Promise<void>;
}

@Injectable()
export class PostgresDatabaseService implements DatabasePort, OnModuleDestroy {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: PostgresPool) {}

  async healthCheck(): Promise<DatabaseHealth> {
    try {
      await this.pool.query("SELECT 1");
      return { status: "ok", provider: "postgresql" };
    } catch {
      return { status: "error", provider: "postgresql" };
    }
  }

  async createQuoteRequest(
    _request: QuoteRequestRecord,
  ): Promise<QuoteRequestRecord> {
    throw new ServiceUnavailableException(
      "PostgreSQL business persistence is not configured",
    );
  }

  async listQuoteRequests(): Promise<QuoteRequestRecord[]> {
    throw new ServiceUnavailableException(
      "PostgreSQL business persistence is not configured",
    );
  }

  async findQuoteRequest(_id: string): Promise<QuoteRequestRecord | null> {
    throw new ServiceUnavailableException(
      "PostgreSQL business persistence is not configured",
    );
  }

  async createCustomer(
    _customer: CustomerCompanyRecord,
  ): Promise<CustomerCompanyRecord> {
    throw new ServiceUnavailableException(
      "PostgreSQL business persistence is not configured",
    );
  }

  async listCustomers(_search: string): Promise<CustomerCompanyRecord[]> {
    throw new ServiceUnavailableException(
      "PostgreSQL business persistence is not configured",
    );
  }

  async findCustomer(_id: string): Promise<CustomerCompanyRecord | null> {
    throw new ServiceUnavailableException(
      "PostgreSQL business persistence is not configured",
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
