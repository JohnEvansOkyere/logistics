import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  DatabaseHealth,
  DatabasePort,
  CustomerCompanyRecord,
  CustomerMembershipRecord,
  QuoteDraftRecord,
  QuoteRequestRecord,
  StaffRoleKey,
  StaffRoleAssignmentRecord,
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
    allowedCompanyIds?: string[],
  ): Promise<QuoteRequestRecord[]> {
    if (allowedCompanyIds?.length === 0) return [];
    const scopeClause = allowedCompanyIds
      ? `AND request.customer_company_id IN (${allowedCompanyIds.map(() => "?").join(",")})`
      : "";
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
         WHERE (? IS NULL OR request.customer_company_id = ?)
         ${scopeClause}
         ORDER BY request.created_at DESC, request.id DESC`,
      )
      .all(
        customerCompanyId ?? null,
        customerCompanyId ?? null,
        ...(allowedCompanyIds ?? []),
      ) as QuoteRequestRow[];

    return rows.map((row) => this.toQuoteRequest(row));
  }

  async findQuoteRequest(
    id: string,
    allowedCompanyIds?: string[],
  ): Promise<QuoteRequestRecord | null> {
    if (allowedCompanyIds?.length === 0) return null;
    const scopeClause = allowedCompanyIds
      ? `AND request.customer_company_id IN (${allowedCompanyIds.map(() => "?").join(",")})`
      : "";
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
         WHERE request.id = ? ${scopeClause}`,
      )
      .get(id, ...(allowedCompanyIds ?? [])) as QuoteRequestRow | undefined;

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
        `SELECT id, revision_number, content, created_at, saved_by_user_id
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
        savedBy: revision.saved_by_user_id,
      })),
    };
  }

  async saveQuoteDraft(
    requestId: string,
    content: string,
    savedBy: string,
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
            (id, quote_draft_id, revision_number, content, created_at, saved_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          revisionId,
          draft.id,
          revisionNumber.next_revision,
          content,
          savedAt,
          savedBy,
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

  async listCustomers(
    search: string,
    companyIds?: string[],
  ): Promise<CustomerCompanyRecord[]> {
    if (companyIds?.length === 0) return [];
    const companyClause = companyIds
      ? `AND company.id IN (${companyIds.map(() => "?").join(",")})`
      : "";
    const rows = this.connection
      .prepare(
        `WITH matching_company AS (
           SELECT DISTINCT company.id
           FROM customer_company AS company
           LEFT JOIN customer_contact AS contact
             ON contact.company_id = company.id
           WHERE ? = ''
             OR instr(lower(company.company_name), lower(?)) > 0
             OR instr(lower(contact.contact_name), lower(?)) > 0
             OR instr(lower(contact.email), lower(?)) > 0
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
         WHERE 1 = 1 ${companyClause}
         ORDER BY company.company_name COLLATE NOCASE,
           company.created_at,
           contact.contact_name COLLATE NOCASE`,
      )
      .all(
        search,
        search,
        search,
        search,
        ...(companyIds ?? []),
      ) as CustomerRow[];

    return this.groupCustomers(rows);
  }

  async findCustomer(
    id: string,
    companyIds?: string[],
  ): Promise<CustomerCompanyRecord | null> {
    if (companyIds?.length === 0) return null;
    const companyClause = companyIds
      ? `AND company.id IN (${companyIds.map(() => "?").join(",")})`
      : "";
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
         WHERE company.id = ? ${companyClause}
         ORDER BY contact.contact_name COLLATE NOCASE`,
      )
      .all(id, ...(companyIds ?? [])) as CustomerRow[];

    return this.groupCustomers(rows)[0] ?? null;
  }

  async getActiveCustomerCompanyIds(userId: string): Promise<string[]> {
    const rows = this.connection
      .prepare(
        `SELECT company_id FROM customer_membership
         WHERE user_id = ? AND revoked_at IS NULL ORDER BY company_id`,
      )
      .all(userId) as Array<{ company_id: string }>;
    return rows.map((row) => row.company_id);
  }

  async listCustomerMemberships(
    userId: string,
  ): Promise<CustomerMembershipRecord[]> {
    const rows = this.connection
      .prepare(
        `SELECT membership_id, company_id, user_id, granted_by, granted_at, revoked_at
         FROM customer_membership WHERE user_id = ?
         ORDER BY granted_at DESC, membership_id DESC`,
      )
      .all(userId) as Array<{
      membership_id: string;
      company_id: string;
      user_id: string;
      granted_by: string;
      granted_at: string;
      revoked_at: string | null;
    }>;
    return rows.map((row) => ({
      id: row.membership_id,
      companyId: row.company_id,
      userId: row.user_id,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
    }));
  }

  async grantCustomerMembership(
    companyId: string,
    userId: string,
    grantedBy: string,
  ): Promise<CustomerMembershipRecord | "already_active"> {
    const membership: CustomerMembershipRecord = {
      id: randomUUID(),
      companyId,
      userId,
      grantedBy,
      grantedAt: new Date().toISOString(),
      revokedAt: null,
    };
    try {
      this.connection.transaction(() => {
        this.connection
          .prepare(
            `INSERT INTO customer_membership
              (membership_id, company_id, user_id, granted_by, granted_at)
             VALUES (@id, @companyId, @userId, @grantedBy, @grantedAt)`,
          )
          .run(membership);
        this.connection
          .prepare(
            `INSERT INTO customer_membership_audit_event
              (event_id, actor_user_id, event_type, membership_id, occurred_at)
             VALUES (?, ?, 'customer_membership_granted', ?, ?)`,
          )
          .run(randomUUID(), grantedBy, membership.id, membership.grantedAt);
      })();
      return membership;
    } catch (error) {
      if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
        return "already_active";
      }
      throw error;
    }
  }

  async revokeCustomerMembership(
    companyId: string,
    userId: string,
    revokedBy: string,
  ): Promise<boolean> {
    const revokedAt = new Date().toISOString();
    return this.connection.transaction(() => {
      const membership = this.connection
        .prepare(
          `SELECT membership_id FROM customer_membership
           WHERE company_id = ? AND user_id = ? AND revoked_at IS NULL`,
        )
        .get(companyId, userId) as { membership_id: string } | undefined;
      if (!membership) return false;
      this.connection
        .prepare(
          `UPDATE customer_membership SET revoked_at = ? WHERE membership_id = ?`,
        )
        .run(revokedAt, membership.membership_id);
      this.connection
        .prepare(
          `INSERT INTO customer_membership_audit_event
            (event_id, actor_user_id, event_type, membership_id, occurred_at)
           VALUES (?, ?, 'customer_membership_revoked', ?, ?)`,
        )
        .run(randomUUID(), revokedBy, membership.membership_id, revokedAt);
      return true;
    })();
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
    const assignmentId = randomUUID();
    const assignedAt = new Date().toISOString();
    return this.connection.transaction(() => {
      const result = this.connection
        .prepare(
          `INSERT INTO staff_role_assignment
            (assignment_id, user_id, role_key, assigned_at, assigned_by)
           SELECT @assignmentId, @userId, 'super_admin', @assignedAt, @userId
           WHERE NOT EXISTS (
             SELECT 1 FROM staff_role_assignment
             WHERE role_key = 'super_admin' AND revoked_at IS NULL
           )`,
        )
        .run({ assignmentId, userId, assignedAt });
      if (result.changes === 1) {
        this.connection
          .prepare(
            `INSERT INTO staff_role_audit_event
              (event_id, actor_user_id, event_type, assignment_id, occurred_at)
             VALUES (?, ?, 'staff_role_assigned', ?, ?)`,
          )
          .run(randomUUID(), userId, assignmentId, assignedAt);
      }
      return result.changes === 1;
    })();
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

  async listStaffRoleAssignments(): Promise<StaffRoleAssignmentRecord[]> {
    const rows = this.connection
      .prepare(
        `SELECT assignment_id, user_id, role_key, assigned_by, assigned_at, revoked_at
         FROM staff_role_assignment ORDER BY assigned_at DESC, assignment_id DESC`,
      )
      .all() as Array<{
      assignment_id: string;
      user_id: string;
      role_key: StaffRoleKey;
      assigned_by: string;
      assigned_at: string;
      revoked_at: string | null;
    }>;
    return rows.map((row) => ({
      id: row.assignment_id,
      userId: row.user_id,
      roleKey: row.role_key,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      revokedAt: row.revoked_at,
    }));
  }

  async assignStaffRole(
    userId: string,
    roleKey: StaffRoleKey,
    assignedBy: string,
  ): Promise<
    StaffRoleAssignmentRecord | "super_admin_exists" | "already_active"
  > {
    const assignment: StaffRoleAssignmentRecord = {
      id: randomUUID(),
      userId,
      roleKey,
      assignedBy,
      assignedAt: new Date().toISOString(),
      revokedAt: null,
    };
    try {
      this.connection.transaction(() => {
        this.connection
          .prepare(
            `INSERT INTO staff_role_assignment
              (assignment_id, user_id, role_key, assigned_by, assigned_at)
             VALUES (@id, @userId, @roleKey, @assignedBy, @assignedAt)`,
          )
          .run(assignment);
        this.connection
          .prepare(
            `INSERT INTO staff_role_audit_event
              (event_id, actor_user_id, event_type, assignment_id, occurred_at)
             VALUES (?, ?, 'staff_role_assigned', ?, ?)`,
          )
          .run(randomUUID(), assignedBy, assignment.id, assignment.assignedAt);
      })();
      return assignment;
    } catch (error) {
      if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
        if (
          roleKey === "super_admin" &&
          this.connection
            .prepare(
              `SELECT 1 FROM staff_role_assignment
               WHERE role_key = 'super_admin' AND revoked_at IS NULL LIMIT 1`,
            )
            .get()
        ) {
          return "super_admin_exists";
        }
        return "already_active";
      }
      throw error;
    }
  }

  async revokeStaffRole(
    userId: string,
    roleKey: StaffRoleKey,
    revokedBy: string,
  ): Promise<"revoked" | "not_found" | "last_super_admin"> {
    return this.connection.transaction(() => {
      const assignment = this.connection
        .prepare(
          `SELECT assignment_id FROM staff_role_assignment
           WHERE user_id = ? AND role_key = ? AND revoked_at IS NULL`,
        )
        .get(userId, roleKey) as { assignment_id: string } | undefined;
      if (!assignment) return "not_found";
      const superAdminCount = this.connection
        .prepare(
          `SELECT COUNT(*) AS count FROM staff_role_assignment
           WHERE role_key = 'super_admin' AND revoked_at IS NULL`,
        )
        .get() as { count: number };
      if (roleKey === "super_admin" && superAdminCount.count === 1) {
        return "last_super_admin";
      }
      const revokedAt = new Date().toISOString();
      this.connection
        .prepare(
          `UPDATE staff_role_assignment SET revoked_at = ?
           WHERE assignment_id = ? AND revoked_at IS NULL`,
        )
        .run(revokedAt, assignment.assignment_id);
      this.connection
        .prepare(
          `INSERT INTO staff_role_audit_event
            (event_id, actor_user_id, event_type, assignment_id, occurred_at)
           VALUES (?, ?, 'staff_role_revoked', ?, ?)`,
        )
        .run(randomUUID(), revokedBy, assignment.assignment_id, revokedAt);
      return "revoked";
    })();
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
  saved_by_user_id: string | null;
};
