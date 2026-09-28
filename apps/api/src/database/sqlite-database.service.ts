import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  DatabaseHealth,
  DatabasePort,
  CustomerCompanyRecord,
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

  async createCustomer(
    customer: CustomerCompanyRecord,
  ): Promise<CustomerCompanyRecord> {
    const insertCompany = this.connection.prepare(
      `INSERT INTO customer_company (id, company_name, created_at)
       VALUES (@id, @companyName, @createdAt)`,
    );
    const insertContact = this.connection.prepare(
      `INSERT INTO customer_contact
        (id, company_id, contact_name, email, created_at)
       VALUES (@id, @companyId, @name, @email, @createdAt)`,
    );

    this.connection.transaction(() => {
      insertCompany.run(customer);
      for (const contact of customer.contacts) {
        insertContact.run({ ...contact, companyId: customer.id });
      }
    })();

    return customer;
  }

  async listCustomers(search: string): Promise<CustomerCompanyRecord[]> {
    const rows = this.connection
      .prepare(
        `WITH matching_company AS (
           SELECT DISTINCT company.id
           FROM customer_company AS company
           LEFT JOIN customer_contact AS contact
             ON contact.company_id = company.id
           WHERE @search = ''
             OR instr(lower(company.company_name), lower(@search)) > 0
             OR instr(lower(contact.contact_name), lower(@search)) > 0
             OR instr(lower(contact.email), lower(@search)) > 0
         )
         SELECT
           company.id AS company_id,
           company.company_name,
           company.created_at AS company_created_at,
           contact.id AS contact_id,
           contact.contact_name,
           contact.email AS contact_email,
           contact.created_at AS contact_created_at
         FROM customer_company AS company
         JOIN matching_company AS matching
           ON matching.id = company.id
         LEFT JOIN customer_contact AS contact
           ON contact.company_id = company.id
         ORDER BY company.company_name COLLATE NOCASE,
           company.created_at,
           contact.contact_name COLLATE NOCASE`,
      )
      .all({ search }) as CustomerRow[];

    return this.groupCustomers(rows);
  }

  async findCustomer(id: string): Promise<CustomerCompanyRecord | null> {
    const rows = this.connection
      .prepare(
        `SELECT
           company.id AS company_id,
           company.company_name,
           company.created_at AS company_created_at,
           contact.id AS contact_id,
           contact.contact_name,
           contact.email AS contact_email,
           contact.created_at AS contact_created_at
         FROM customer_company AS company
         LEFT JOIN customer_contact AS contact
           ON contact.company_id = company.id
         WHERE company.id = ?
         ORDER BY contact.contact_name COLLATE NOCASE`,
      )
      .all(id) as CustomerRow[];

    return this.groupCustomers(rows)[0] ?? null;
  }

  private groupCustomers(rows: CustomerRow[]): CustomerCompanyRecord[] {
    const customers = new Map<string, CustomerCompanyRecord>();
    for (const row of rows) {
      let customer = customers.get(row.company_id);
      if (!customer) {
        customer = {
          id: row.company_id,
          companyName: row.company_name,
          createdAt: row.company_created_at,
          contacts: [],
        };
        customers.set(customer.id, customer);
      }

      if (
        row.contact_id &&
        row.contact_name !== null &&
        row.contact_email !== null &&
        row.contact_created_at !== null
      ) {
        customer.contacts.push({
          id: row.contact_id,
          name: row.contact_name,
          email: row.contact_email,
          createdAt: row.contact_created_at,
        });
      }
    }

    return [...customers.values()];
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

type CustomerRow = {
  company_id: string;
  company_name: string;
  company_created_at: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_created_at: string | null;
};
