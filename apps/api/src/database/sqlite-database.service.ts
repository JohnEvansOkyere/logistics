import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  DatabaseHealth,
  DatabasePort,
  CustomerCompanyRecord,
  QuoteDraftRecord,
  QuoteRequestRecord,
  StaffRoleKey,
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

  async listQuoteRequests(
    customerCompanyId?: string,
  ): Promise<QuoteRequestRecord[]> {
    const rows = this.connection
      .prepare(
        `SELECT
           request.id,
           request.company_name,
           request.contact_name,
           request.email,
           request.message,
           request.created_at,
           request.customer_company_id,
           company.company_name AS customer_company_name,
           (SELECT COUNT(*) FROM quote_draft_revision AS revision
             JOIN quote_draft AS draft ON draft.id = revision.quote_draft_id
             WHERE draft.quote_request_id = request.id) AS quote_draft_revision_count,
           (SELECT draft.updated_at FROM quote_draft AS draft
             WHERE draft.quote_request_id = request.id) AS quote_draft_updated_at
         FROM quote_request AS request
         LEFT JOIN customer_company AS company
           ON company.id = request.customer_company_id
         WHERE @customerCompanyId IS NULL
           OR request.customer_company_id = @customerCompanyId
         ORDER BY request.created_at DESC, request.id DESC`,
      )
      .all({
        customerCompanyId: customerCompanyId ?? null,
      }) as QuoteRequestRow[];

    return rows.map((row) => this.toQuoteRequest(row));
  }

  async findQuoteRequest(id: string): Promise<QuoteRequestRecord | null> {
    const row = this.connection
      .prepare(
        `SELECT
           request.id,
           request.company_name,
           request.contact_name,
           request.email,
           request.message,
           request.created_at,
           request.customer_company_id,
           company.company_name AS customer_company_name,
           (SELECT COUNT(*) FROM quote_draft_revision AS revision
             JOIN quote_draft AS draft ON draft.id = revision.quote_draft_id
             WHERE draft.quote_request_id = request.id) AS quote_draft_revision_count,
           (SELECT draft.updated_at FROM quote_draft AS draft
             WHERE draft.quote_request_id = request.id) AS quote_draft_updated_at
         FROM quote_request AS request
         LEFT JOIN customer_company AS company
           ON company.id = request.customer_company_id
         WHERE request.id = ?`,
      )
      .get(id) as QuoteRequestRow | undefined;

    return row ? this.toQuoteRequest(row) : null;
  }

  async linkQuoteRequestToCustomer(
    requestId: string,
    customerCompanyId: string,
  ): Promise<QuoteRequestRecord | null> {
    const result = this.connection
      .prepare("UPDATE quote_request SET customer_company_id = ? WHERE id = ?")
      .run(customerCompanyId, requestId);

    return result.changes === 0 ? null : this.findQuoteRequest(requestId);
  }

  async findQuoteDraft(requestId: string): Promise<QuoteDraftRecord | null> {
    const draft = this.connection
      .prepare(
        `SELECT id, quote_request_id, content, created_at, updated_at
         FROM quote_draft WHERE quote_request_id = ?`,
      )
      .get(requestId) as QuoteDraftRow | undefined;

    if (!draft) {
      return null;
    }

    const revisions = this.connection
      .prepare(
        `SELECT id, revision_number, content, created_at
         FROM quote_draft_revision
         WHERE quote_draft_id = ?
         ORDER BY revision_number DESC`,
      )
      .all(draft.id) as QuoteDraftRevisionRow[];

    return {
      id: draft.id,
      requestId: draft.quote_request_id,
      content: draft.content,
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
      revisions: revisions.map((revision) => ({
        id: revision.id,
        revisionNumber: revision.revision_number,
        content: revision.content,
        createdAt: revision.created_at,
      })),
    };
  }

  async saveQuoteDraft(
    requestId: string,
    content: string,
    savedAt: string,
  ): Promise<QuoteDraftRecord> {
    const draftId = randomUUID();
    const revisionId = randomUUID();
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `INSERT INTO quote_draft (id, quote_request_id, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (quote_request_id) DO UPDATE SET
             content = excluded.content,
             updated_at = excluded.updated_at`,
        )
        .run(draftId, requestId, content, savedAt, savedAt);

      const draft = this.connection
        .prepare("SELECT id FROM quote_draft WHERE quote_request_id = ?")
        .get(requestId) as { id: string };
      const revisionNumber = this.connection
        .prepare(
          `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_revision
           FROM quote_draft_revision WHERE quote_draft_id = ?`,
        )
        .get(draft.id) as { next_revision: number };
      this.connection
        .prepare(
          `INSERT INTO quote_draft_revision
            (id, quote_draft_id, revision_number, content, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          revisionId,
          draft.id,
          revisionNumber.next_revision,
          content,
          savedAt,
        );
    })();

    const saved = await this.findQuoteDraft(requestId);
    if (!saved) {
      throw new Error("Saved quote draft could not be loaded");
    }
    return saved;
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

  async hasActiveSuperAdmin(): Promise<boolean> {
    return Boolean(
      this.connection
        .prepare(
          `SELECT 1 FROM staff_role_assignment
           WHERE role_key = 'super_admin' AND revoked_at IS NULL
           LIMIT 1`,
        )
        .get(),
    );
  }

  async claimInitialSuperAdmin(userId: string): Promise<boolean> {
    const result = this.connection
      .prepare(
        `INSERT INTO staff_role_assignment
          (assignment_id, user_id, role_key, assigned_at)
         SELECT @assignmentId, @userId, 'super_admin', @assignedAt
         WHERE NOT EXISTS (
           SELECT 1 FROM staff_role_assignment
           WHERE role_key = 'super_admin' AND revoked_at IS NULL
         )`,
      )
      .run({
        assignmentId: randomUUID(),
        userId,
        assignedAt: new Date().toISOString(),
      });

    return result.changes === 1;
  }

  async getActiveStaffRoles(userId: string): Promise<StaffRoleKey[]> {
    const rows = this.connection
      .prepare(
        `SELECT role_key FROM staff_role_assignment
         WHERE user_id = ? AND revoked_at IS NULL`,
      )
      .all(userId) as Array<{ role_key: StaffRoleKey }>;

    return rows.map(({ role_key }) => role_key);
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
    customer_company_id: string | null;
    customer_company_name: string | null;
    quote_draft_revision_count: number;
    quote_draft_updated_at: string | null;
  }): QuoteRequestRecord {
    return {
      id: row.id,
      companyName: row.company_name,
      contactName: row.contact_name,
      email: row.email,
      message: row.message,
      createdAt: row.created_at,
      customerCompanyId: row.customer_company_id,
      customerCompanyName: row.customer_company_name,
      quoteDraftRevisionCount: row.quote_draft_revision_count,
      quoteDraftUpdatedAt: row.quote_draft_updated_at,
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

type QuoteRequestRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  message: string;
  created_at: string;
  customer_company_id: string | null;
  customer_company_name: string | null;
  quote_draft_revision_count: number;
  quote_draft_updated_at: string | null;
};

type QuoteDraftRow = {
  id: string;
  quote_request_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type QuoteDraftRevisionRow = {
  id: string;
  revision_number: number;
  content: string;
  created_at: string;
};
