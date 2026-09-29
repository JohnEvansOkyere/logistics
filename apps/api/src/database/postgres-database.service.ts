import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  DatabaseHealth,
  DatabasePort,
  CustomerCompanyRecord,
  CustomerMembershipRecord,
  QuoteDraftRecord,
  QuoteRequestRecord,
  DepartmentRoleKey,
  StaffRoleKey,
  StaffRoleAssignmentRecord,
} from "./database.port";

export const POSTGRES_POOL = Symbol("POSTGRES_POOL");

export interface PostgresQueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount?: number | null;
}

export interface PostgresClient {
  query(queryText: string, values?: unknown[]): Promise<PostgresQueryResult>;
  release(): void;
}

export interface PostgresPool {
  query(queryText: string, values?: unknown[]): Promise<PostgresQueryResult>;
  connect(): Promise<PostgresClient>;
  end(): Promise<void>;
}

const quoteRequestSelect = `
  SELECT
    request.request_id,
    request.company_name,
    request.contact_name,
    request.email,
    request.message,
    request.created_at,
    request.customer_company_id,
    company.company_name AS customer_company_name,
    (SELECT COUNT(*)
     FROM app.quote_draft_revision AS revision
     JOIN app.quote_draft AS draft ON draft.draft_id = revision.draft_id
     WHERE draft.request_id = request.request_id) AS quote_draft_revision_count,
    (SELECT draft.updated_at
     FROM app.quote_draft AS draft
     WHERE draft.request_id = request.request_id) AS quote_draft_updated_at
  FROM app.quote_request AS request
  LEFT JOIN app.customer_company AS company
    ON company.company_id = request.customer_company_id`;

const customerSelect = `
  SELECT
    company.company_id,
    company.company_name,
    company.created_at AS company_created_at,
    contact.contact_id,
    contact.contact_name,
    contact.email AS contact_email,
    contact.created_at AS contact_created_at
  FROM app.customer_company AS company
  LEFT JOIN app.customer_contact AS contact ON contact.company_id = company.company_id`;

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
    request: QuoteRequestRecord,
  ): Promise<QuoteRequestRecord> {
    await this.pool.query(
      `INSERT INTO app.quote_request
        (request_id, company_name, contact_name, email, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        request.id,
        request.companyName,
        request.contactName,
        request.email,
        request.message,
        request.createdAt,
      ],
    );
    const created = await this.findQuoteRequest(request.id);
    if (!created) {
      throw new Error("Created quote request could not be loaded");
    }
    return created;
  }

  async listQuoteRequests(
    customerCompanyId?: string,
    allowedCompanyIds?: string[],
  ): Promise<QuoteRequestRecord[]> {
    if (allowedCompanyIds?.length === 0) return [];
    const result = await this.pool.query(
      `${quoteRequestSelect}
       WHERE ($1::text IS NULL OR request.customer_company_id::text = $1)
         AND ($2::uuid[] IS NULL OR request.customer_company_id = ANY($2::uuid[]))
       ORDER BY request.created_at DESC, request.request_id DESC`,
      [customerCompanyId ?? null, allowedCompanyIds ?? null],
    );
    return result.rows.map((row) => this.toQuoteRequest(row));
  }

  async findQuoteRequest(
    id: string,
    allowedCompanyIds?: string[],
  ): Promise<QuoteRequestRecord | null> {
    if (allowedCompanyIds?.length === 0) return null;
    const result = await this.pool.query(
      `${quoteRequestSelect}
       WHERE request.request_id::text = $1
         AND ($2::uuid[] IS NULL OR request.customer_company_id = ANY($2::uuid[]))`,
      [id, allowedCompanyIds ?? null],
    );
    return result.rows[0] ? this.toQuoteRequest(result.rows[0]) : null;
  }

  async linkQuoteRequestToCustomer(
    requestId: string,
    customerCompanyId: string,
  ): Promise<QuoteRequestRecord | null> {
    const result = await this.pool.query(
      `UPDATE app.quote_request
       SET customer_company_id = $2::uuid
       WHERE request_id::text = $1`,
      [requestId, customerCompanyId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return this.findQuoteRequest(requestId);
  }

  async getQuoteRequestDepartment(
    requestId: string,
  ): Promise<DepartmentRoleKey | null | undefined> {
    const result = await this.pool.query(
      `SELECT assigned_department_role FROM app.quote_request WHERE request_id::text = $1`,
      [requestId],
    );
    if (!result.rows[0]) return undefined;
    return result.rows[0].assigned_department_role as DepartmentRoleKey | null;
  }

  async assignQuoteRequestDepartment(
    requestId: string,
    roleKey: DepartmentRoleKey | null,
    assignedBy: string,
    assignedAt: string,
  ): Promise<DepartmentRoleKey | null | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const currentResult = await client.query(
        `SELECT assigned_department_role FROM app.quote_request WHERE request_id::text = $1 FOR UPDATE`,
        [requestId],
      );
      if (!currentResult.rows[0]) {
        await client.query("COMMIT");
        return undefined;
      }
      const previousRole = currentResult.rows[0]
        .assigned_department_role as DepartmentRoleKey | null;
      if (previousRole === roleKey) {
        await client.query("COMMIT");
        return roleKey;
      }
      await client.query(
        `UPDATE app.quote_request SET assigned_department_role = $2 WHERE request_id::text = $1`,
        [requestId, roleKey],
      );
      await client.query(
        `INSERT INTO app.quote_request_assignment_history
          (request_id, previous_role, assigned_role, assigned_by, assigned_at)
         VALUES ($1::uuid, $2, $3, $4::uuid, $5)`,
        [requestId, previousRole, roleKey, assignedBy, assignedAt],
      );
      await client.query("COMMIT");
      return roleKey;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async findQuoteDraft(requestId: string): Promise<QuoteDraftRecord | null> {
    const draftResult = await this.pool.query(
      `SELECT draft_id, request_id, content, created_at, updated_at
       FROM app.quote_draft WHERE request_id::text = $1`,
      [requestId],
    );
    const draft = draftResult.rows[0];
    if (!draft) {
      return null;
    }

    const revisionResult = await this.pool.query(
      `SELECT revision_id, revision_number, content, created_at, saved_by
       FROM app.quote_draft_revision
       WHERE draft_id = $1::uuid
       ORDER BY revision_number DESC`,
      [draft.draft_id],
    );
    return {
      id: String(draft.draft_id),
      requestId: String(draft.request_id),
      content: String(draft.content),
      createdAt: this.toIsoString(draft.created_at),
      updatedAt: this.toIsoString(draft.updated_at),
      revisions: revisionResult.rows.map((revision) => ({
        id: String(revision.revision_id),
        revisionNumber: Number(revision.revision_number),
        content: String(revision.content),
        createdAt: this.toIsoString(revision.created_at),
        savedBy: String(revision.saved_by),
      })),
    };
  }

  async saveQuoteDraft(
    requestId: string,
    content: string,
    savedBy: string,
    savedAt: string,
  ): Promise<QuoteDraftRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const draftResult = await client.query(
        `INSERT INTO app.quote_draft
          (draft_id, request_id, content, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3, $3)
         ON CONFLICT (request_id) DO UPDATE SET
           content = EXCLUDED.content,
           updated_at = EXCLUDED.updated_at
         RETURNING draft_id`,
        [requestId, content, savedAt],
      );
      const draftId = String(draftResult.rows[0].draft_id);
      const nextRevision = await client.query(
        `SELECT COALESCE(MAX(revision_number), 0) + 1 AS revision_number
         FROM app.quote_draft_revision WHERE draft_id = $1::uuid`,
        [draftId],
      );
      await client.query(
        `INSERT INTO app.quote_draft_revision
          (revision_id, draft_id, revision_number, content, created_at, saved_by)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5::uuid)`,
        [
          draftId,
          Number(nextRevision.rows[0].revision_number),
          content,
          savedAt,
          savedBy,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const saved = await this.findQuoteDraft(requestId);
    if (!saved) {
      throw new Error("Saved quote draft could not be loaded");
    }
    return saved;
  }

  async createCustomer(
    customer: CustomerCompanyRecord,
  ): Promise<CustomerCompanyRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO app.customer_company (company_id, company_name, created_at)
         VALUES ($1::uuid, $2, $3)`,
        [customer.id, customer.companyName, customer.createdAt],
      );
      for (const contact of customer.contacts) {
        await client.query(
          `INSERT INTO app.customer_contact
            (contact_id, company_id, contact_name, email, created_at)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
          [
            contact.id,
            customer.id,
            contact.name,
            contact.email,
            contact.createdAt,
          ],
        );
      }
      await client.query("COMMIT");
      return customer;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listCustomers(
    search: string,
    companyIds?: string[],
  ): Promise<CustomerCompanyRecord[]> {
    if (companyIds?.length === 0) return [];
    const result = await this.pool.query(
      `${customerSelect}
       WHERE ($1 = ''
         OR strpos(lower(company.company_name), lower($1)) > 0
         OR strpos(lower(COALESCE(contact.contact_name, '')), lower($1)) > 0
         OR strpos(lower(COALESCE(contact.email, '')), lower($1)) > 0)
         AND ($2::uuid[] IS NULL OR company.company_id = ANY($2::uuid[]))
       ORDER BY company.company_name, company.created_at, contact.contact_name`,
      [search, companyIds ?? null],
    );
    return this.groupCustomers(result.rows);
  }

  async findCustomer(
    id: string,
    companyIds?: string[],
  ): Promise<CustomerCompanyRecord | null> {
    if (companyIds?.length === 0) return null;
    const result = await this.pool.query(
      `${customerSelect}
       WHERE company.company_id::text = $1
         AND ($2::uuid[] IS NULL OR company.company_id = ANY($2::uuid[]))
       ORDER BY contact.contact_name`,
      [id, companyIds ?? null],
    );
    return this.groupCustomers(result.rows)[0] ?? null;
  }

  async getActiveCustomerCompanyIds(userId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT company_id FROM app.customer_membership
       WHERE user_id = $1::uuid AND revoked_at IS NULL ORDER BY company_id`,
      [userId],
    );
    return result.rows.map((row) => String(row.company_id));
  }

  async listCustomerMemberships(
    userId: string,
  ): Promise<CustomerMembershipRecord[]> {
    const result = await this.pool.query(
      `SELECT membership_id, company_id, user_id, granted_by, granted_at, revoked_at
       FROM app.customer_membership WHERE user_id = $1::uuid
       ORDER BY granted_at DESC, membership_id DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: String(row.membership_id),
      companyId: String(row.company_id),
      userId: String(row.user_id),
      grantedBy: String(row.granted_by),
      grantedAt: this.toIsoString(row.granted_at),
      revokedAt: row.revoked_at ? this.toIsoString(row.revoked_at) : null,
    }));
  }

  async grantCustomerMembership(
    companyId: string,
    userId: string,
    grantedBy: string,
  ): Promise<CustomerMembershipRecord | "already_active"> {
    const result = await this.pool.query(
      `INSERT INTO app.customer_membership (company_id, user_id, granted_by)
       VALUES ($1::uuid, $2::uuid, $3::uuid)
       ON CONFLICT DO NOTHING
       RETURNING membership_id, company_id, user_id, granted_by, granted_at, revoked_at`,
      [companyId, userId, grantedBy],
    );
    const row = result.rows[0];
    if (!row) return "already_active";
    return {
      id: String(row.membership_id),
      companyId: String(row.company_id),
      userId: String(row.user_id),
      grantedBy: String(row.granted_by),
      grantedAt: this.toIsoString(row.granted_at),
      revokedAt: row.revoked_at ? this.toIsoString(row.revoked_at) : null,
    };
  }

  async revokeCustomerMembership(
    companyId: string,
    userId: string,
    revokedBy: string,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT set_config('request.jwt.claim.sub', $1, true)",
        [revokedBy],
      );
      const result = await client.query(
        `UPDATE app.customer_membership SET revoked_at = now()
         WHERE company_id = $1::uuid AND user_id = $2::uuid AND revoked_at IS NULL`,
        [companyId, userId],
      );
      await client.query("COMMIT");
      return Boolean(result.rowCount);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async hasActiveSuperAdmin(): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM app.super_admin_bootstrap_claim WHERE singleton = true
       ) OR EXISTS (
         SELECT 1 FROM app.staff_role_assignment
         WHERE role_key = 'super_admin' AND revoked_at IS NULL
       ) AS claimed`,
    );
    return Boolean(result.rows[0]?.claimed);
  }

  async claimInitialSuperAdmin(userId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('bjh_super_admin_role')::bigint)",
      );
      const existing = await client.query(
        `SELECT 1 FROM app.super_admin_bootstrap_claim WHERE singleton = true
         UNION ALL
         SELECT 1 FROM app.staff_role_assignment
         WHERE role_key = 'super_admin' AND revoked_at IS NULL
         LIMIT 1`,
      );
      if (existing.rows.length > 0) {
        await client.query("COMMIT");
        return false;
      }
      await client.query(
        `INSERT INTO app.super_admin_bootstrap_claim
          (singleton, claimed_user_id) VALUES (true, $1::uuid)`,
        [userId],
      );
      await client.query(
        `INSERT INTO app.staff_role_assignment
          (user_id, role_key, assigned_by)
         VALUES ($1::uuid, 'super_admin', $1::uuid)`,
        [userId],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getActiveStaffRoles(userId: string): Promise<StaffRoleKey[]> {
    const result = await this.pool.query(
      `SELECT role_key FROM app.staff_role_assignment
       WHERE user_id = $1::uuid AND revoked_at IS NULL`,
      [userId],
    );
    return result.rows.map((row) => String(row.role_key) as StaffRoleKey);
  }

  async listStaffRoleAssignments(): Promise<StaffRoleAssignmentRecord[]> {
    const result = await this.pool.query(
      `SELECT assignment_id, user_id, role_key, assigned_by, assigned_at, revoked_at
       FROM app.staff_role_assignment
       ORDER BY assigned_at DESC, assignment_id DESC`,
    );
    return result.rows.map((row) => ({
      id: String(row.assignment_id),
      userId: String(row.user_id),
      roleKey: String(row.role_key) as StaffRoleKey,
      assignedBy: String(row.assigned_by),
      assignedAt: this.toIsoString(row.assigned_at),
      revokedAt: row.revoked_at ? this.toIsoString(row.revoked_at) : null,
    }));
  }

  async assignStaffRole(
    userId: string,
    roleKey: StaffRoleKey,
    assignedBy: string,
  ): Promise<
    StaffRoleAssignmentRecord | "super_admin_exists" | "already_active"
  > {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (roleKey === "super_admin") {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('bjh_super_admin_role')::bigint)",
        );
        const existing = await client.query(
          `SELECT 1 FROM app.staff_role_assignment
           WHERE role_key = 'super_admin' AND revoked_at IS NULL LIMIT 1`,
        );
        if (existing.rows.length) {
          await client.query("COMMIT");
          return "super_admin_exists";
        }
      }
      const result = await client.query(
        `INSERT INTO app.staff_role_assignment (user_id, role_key, assigned_by)
         VALUES ($1::uuid, $2, $3::uuid)
         ON CONFLICT DO NOTHING
         RETURNING assignment_id, user_id, role_key, assigned_by, assigned_at, revoked_at`,
        [userId, roleKey, assignedBy],
      );
      if (!result.rows[0]) {
        await client.query("COMMIT");
        return "already_active";
      }
      const row = result.rows[0];
      await client.query("COMMIT");
      return {
        id: String(row.assignment_id),
        userId: String(row.user_id),
        roleKey: String(row.role_key) as StaffRoleKey,
        assignedBy: String(row.assigned_by),
        assignedAt: this.toIsoString(row.assigned_at),
        revokedAt: null,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeStaffRole(
    userId: string,
    roleKey: StaffRoleKey,
    revokedBy: string,
  ): Promise<"revoked" | "not_found" | "last_super_admin"> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (roleKey === "super_admin") {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('bjh_super_admin_role')::bigint)",
        );
        const count = await client.query(
          `SELECT COUNT(*) AS count FROM app.staff_role_assignment
           WHERE role_key = 'super_admin' AND revoked_at IS NULL`,
        );
        const active = await client.query(
          `SELECT assignment_id FROM app.staff_role_assignment
           WHERE user_id = $1::uuid AND role_key = 'super_admin' AND revoked_at IS NULL`,
          [userId],
        );
        if (active.rows.length === 0) {
          await client.query("COMMIT");
          return "not_found";
        }
        if (Number(count.rows[0].count) <= 1) {
          await client.query("COMMIT");
          return "last_super_admin";
        }
      }
      await client.query(
        "SELECT set_config('request.jwt.claim.sub', $1, true)",
        [revokedBy],
      );
      const result = await client.query(
        `UPDATE app.staff_role_assignment SET revoked_at = now()
         WHERE user_id = $1::uuid AND role_key = $2 AND revoked_at IS NULL`,
        [userId, roleKey],
      );
      await client.query("COMMIT");
      return result.rowCount ? "revoked" : "not_found";
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private toQuoteRequest(row: Record<string, unknown>): QuoteRequestRecord {
    return {
      id: String(row.request_id),
      companyName: String(row.company_name),
      contactName: String(row.contact_name),
      email: String(row.email),
      message: String(row.message),
      createdAt: this.toIsoString(row.created_at),
      customerCompanyId:
        row.customer_company_id === null
          ? null
          : String(row.customer_company_id),
      customerCompanyName:
        row.customer_company_name === null
          ? null
          : String(row.customer_company_name),
      quoteDraftRevisionCount: Number(row.quote_draft_revision_count),
      quoteDraftUpdatedAt:
        row.quote_draft_updated_at === null
          ? null
          : this.toIsoString(row.quote_draft_updated_at),
    };
  }

  private groupCustomers(
    rows: Array<Record<string, unknown>>,
  ): CustomerCompanyRecord[] {
    const customers = new Map<string, CustomerCompanyRecord>();
    for (const row of rows) {
      const id = String(row.company_id);
      let customer = customers.get(id);
      if (!customer) {
        customer = {
          id,
          companyName: String(row.company_name),
          createdAt: this.toIsoString(row.company_created_at),
          contacts: [],
        };
        customers.set(id, customer);
      }
      if (row.contact_id !== null && row.contact_id !== undefined) {
        customer.contacts.push({
          id: String(row.contact_id),
          name: String(row.contact_name),
          email: String(row.contact_email),
          createdAt: this.toIsoString(row.contact_created_at),
        });
      }
    }
    return [...customers.values()];
  }

  private toIsoString(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value));
    return date.toISOString();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
