import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { DatabaseHealth, DatabasePort } from "./database.port";

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

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
