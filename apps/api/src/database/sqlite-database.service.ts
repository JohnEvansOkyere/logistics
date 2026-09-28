import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  DatabaseHealth,
  DatabasePort,
  QuoteRequestRecord,
} from "./database.port";
import { runSqliteMigrations } from "./sqlite-migrations";

@Injectable()
export class SqliteDatabaseService
  implements DatabasePort, OnModuleInit, OnModuleDestroy
{
  private readonly connection: Database.Database;
  private readonly migrationsDirectory = join(__dirname, "migrations");

  constructor() {
    const configuredPath =
      process.env.DATABASE_PATH ?? "../../.local/logistics.sqlite";
    const databasePath = isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath);
    mkdirSync(dirname(databasePath), { recursive: true });
    this.connection = new Database(databasePath);
    this.connection.pragma("foreign_keys = ON");
  }

  onModuleInit(): void {
    runSqliteMigrations(this.connection, this.migrationsDirectory);
  }

  async healthCheck(): Promise<DatabaseHealth> {
    const metadataTable = this.connection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'foundation_metadata'",
      )
      .get();
    const migration = this.connection
      .prepare(
        "SELECT version FROM local_schema_migrations ORDER BY version DESC LIMIT 1",
      )
      .get() as { version: string } | undefined;

    if (!metadataTable || !migration) {
      throw new Error("The local SQLite database has not been migrated");
    }

    return {
      status: "ok",
      provider: "sqlite",
      schemaVersion: migration.version,
    };
  }

  async createQuoteRequest(
    request: QuoteRequestRecord,
  ): Promise<QuoteRequestRecord> {
    this.connection
      .prepare(
        `INSERT INTO quote_request
          (id, company_name, contact_name, email, message, created_at)
         VALUES (@id, @companyName, @contactName, @email, @message, @createdAt)`,
      )
      .run(request);

    return request;
  }

  async listQuoteRequests(): Promise<QuoteRequestRecord[]> {
    const rows = this.connection
      .prepare(
        `SELECT id, company_name, contact_name, email, message, created_at
         FROM quote_request
         ORDER BY created_at DESC, id DESC`,
      )
      .all() as Array<{
      id: string;
      company_name: string;
      contact_name: string;
      email: string;
      message: string;
      created_at: string;
    }>;

    return rows.map((row) => this.toQuoteRequest(row));
  }

  async findQuoteRequest(id: string): Promise<QuoteRequestRecord | null> {
    const row = this.connection
      .prepare(
        `SELECT id, company_name, contact_name, email, message, created_at
         FROM quote_request
         WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          company_name: string;
          contact_name: string;
          email: string;
          message: string;
          created_at: string;
        }
      | undefined;

    return row ? this.toQuoteRequest(row) : null;
  }

  private toQuoteRequest(row: {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    message: string;
    created_at: string;
  }): QuoteRequestRecord {
    return {
      id: row.id,
      companyName: row.company_name,
      contactName: row.contact_name,
      email: row.email,
      message: row.message,
      createdAt: row.created_at,
    };
  }

  onModuleDestroy(): void {
    this.connection.close();
  }
}
