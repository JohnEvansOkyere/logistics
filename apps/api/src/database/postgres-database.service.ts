import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import type {
  BusinessSettings,
  DocumentType,
  QuoteDecision,
  QuoteBasis,
  QuoteVersionInput,
  TaskKind,
  JobStatus,
  PartyRole,
  ReferenceKind,
} from "@bjh/contracts";
import {
  ActivityEntry,
  ActivityFilter,
  ActivityRecord,
  DatabaseHealth,
  DatabasePort,
  CustomerCompanyRecord,
  CustomerMembershipRecord,
  JobRecord,
  DocumentRecord,
  DocumentVersionRecord,
  JobPartyRecord,
  StoredDocumentVersion,
  JobScope,
  ShipmentReferenceRecord,
  JobStatusChangeRecord,
  MilestoneEventRecord,
  EtaEventRecord,
  JobTaskRecord,
  BusinessSettingsRevisionRecord,
  QuoteDecisionRecord,
  QuoteLineRecord,
  QuoteRecord,
  QuoteSummaryRecord,
  QuoteVersionRecord,
  ServiceLine,
  QuoteDraftRecord,
  QuoteRequestRecord,
  DepartmentRoleKey,
  StaffRoleKey,
  StaffRoleAssignmentRecord,
} from "./database.port";

/** Task rows joined to their job; `source` is the table or CTE holding the task. */
const jobTaskSelect = (source: string) => `
  SELECT task.task_id, task.job_id, job.file_number,
    company.company_name, task.kind, task.title, task.details,
    task.assigned_role, to_char(task.due_date, 'YYYY-MM-DD') AS due_date,
    task.status, task.created_at, task.created_by, task.completed_at,
    task.completed_by, task.completion_note
  FROM ${source} AS task
  JOIN app.job AS job ON job.job_id = task.job_id
  JOIN app.customer_company AS company
    ON company.company_id = job.customer_company_id`;

/** Version columns in the order the INSERT/UPDATE statements above expect. */
const quoteVersionValues = (content: QuoteVersionInput) => [
  content.currency,
  content.title,
  content.subtitle,
  content.shipmentScope,
  content.intro,
  content.atCostNote,
  content.procedureSteps,
  content.requiredDocuments,
  content.documentsNote,
  content.timeline,
  content.terms,
];

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

const jobSelect = `
  SELECT
    job.job_id,
    job.file_number,
    job.service_line,
    job.customer_company_id,
    company.company_name AS customer_company_name,
    job.quote_request_id,
    job.status,
    job.opened_by,
    job.opened_at,
    job.closed_at
  FROM app.job AS job
  JOIN app.customer_company AS company
    ON company.company_id = job.customer_company_id`;

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

  async createJob(
    input: {
      customerCompanyId: string;
      serviceLine: ServiceLine;
      quoteRequestId: string | null;
    },
    openedBy: string,
    year: number,
  ): Promise<JobRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const allocated = await client.query(
        "SELECT app.allocate_job_number($1, $2) AS file_number",
        [input.serviceLine, year],
      );
      const inserted = await client.query(
        `INSERT INTO app.job
          (file_number, service_line, customer_company_id, quote_request_id, opened_by)
         VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid)
         RETURNING job_id`,
        [
          String(allocated.rows[0].file_number),
          input.serviceLine,
          input.customerCompanyId,
          input.quoteRequestId,
          openedBy,
        ],
      );
      const created = await client.query(
        `${jobSelect} WHERE job.job_id = $1::uuid`,
        [String(inserted.rows[0].job_id)],
      );
      await client.query("COMMIT");
      return this.mapJob(created.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listJobs(search: string, scope: JobScope): Promise<JobRecord[]> {
    if (scope.companyIds?.length === 0 || scope.serviceLines?.length === 0) {
      return [];
    }
    const result = await this.pool.query(
      `${jobSelect}
       WHERE ($1 = ''
         OR strpos(lower(job.file_number), lower($1)) > 0
         OR strpos(lower(company.company_name), lower($1)) > 0
         OR EXISTS (
           SELECT 1 FROM app.shipment_reference AS reference
           WHERE reference.job_id = job.job_id AND reference.removed_at IS NULL
             AND (strpos(lower(reference.reference_value), lower($1)) > 0
               OR strpos(lower(COALESCE(reference.seal_number, '')), lower($1)) > 0))
         OR strpos(to_char(job.opened_at, 'YYYY-MM-DD'), $1) > 0
         OR EXISTS (
           SELECT 1 FROM app.document AS document
           LEFT JOIN app.document_version AS version
             ON version.document_id = document.document_id
           WHERE document.job_id = job.job_id
             AND (strpos(lower(replace(document.document_type, '_', ' ')), lower($1)) > 0
               OR strpos(lower(COALESCE(version.original_filename, '')), lower($1)) > 0
               OR strpos(to_char(document.created_at, 'YYYY-MM-DD'), $1) > 0))
         OR EXISTS (
           SELECT 1 FROM app.job_party AS party
           WHERE party.job_id = job.job_id AND party.removed_at IS NULL
             AND strpos(lower(party.party_name), lower($1)) > 0))
         AND ($2::uuid[] IS NULL OR job.customer_company_id = ANY($2::uuid[]))
         AND ($3::text[] IS NULL OR job.service_line = ANY($3::text[]))
       ORDER BY job.opened_at DESC, job.file_number DESC`,
      [search, scope.companyIds ?? null, scope.serviceLines ?? null],
    );
    return result.rows.map((row) => this.mapJob(row));
  }

  async findJob(id: string, scope: JobScope): Promise<JobRecord | null> {
    if (scope.companyIds?.length === 0 || scope.serviceLines?.length === 0) {
      return null;
    }
    const result = await this.pool.query(
      `${jobSelect}
       WHERE job.job_id = $1::uuid
         AND ($2::uuid[] IS NULL OR job.customer_company_id = ANY($2::uuid[]))
         AND ($3::text[] IS NULL OR job.service_line = ANY($3::text[]))`,
      [id, scope.companyIds ?? null, scope.serviceLines ?? null],
    );
    return result.rows[0] ? this.mapJob(result.rows[0]) : null;
  }

  private mapJob(row: Record<string, unknown>): JobRecord {
    return {
      id: String(row.job_id),
      fileNumber: String(row.file_number),
      serviceLine: row.service_line as ServiceLine,
      customerCompanyId: String(row.customer_company_id),
      customerCompanyName: String(row.customer_company_name),
      quoteRequestId: row.quote_request_id
        ? String(row.quote_request_id)
        : null,
      status: row.status as JobRecord["status"],
      openedBy: String(row.opened_by),
      openedAt: this.toIsoString(row.opened_at),
      closedAt: row.closed_at ? this.toIsoString(row.closed_at) : null,
    };
  }

  async addJobParty(party: {
    jobId: string;
    role: PartyRole;
    name: string;
    details: string | null;
    createdBy: string;
  }): Promise<JobPartyRecord> {
    const result = await this.pool.query(
      `INSERT INTO app.job_party (job_id, role, party_name, details, created_by)
       VALUES ($1::uuid, $2, $3, $4, $5::uuid) RETURNING *`,
      [party.jobId, party.role, party.name, party.details, party.createdBy],
    );
    return this.mapParty(result.rows[0]);
  }

  async listJobParties(jobId: string): Promise<JobPartyRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM app.job_party
       WHERE job_id = $1::uuid AND removed_at IS NULL
       ORDER BY created_at, party_id`,
      [jobId],
    );
    return result.rows.map((row) => this.mapParty(row));
  }

  async removeJobParty(
    jobId: string,
    partyId: string,
    removedBy: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE app.job_party SET removed_by = $3::uuid, removed_at = clock_timestamp()
       WHERE party_id = $2::uuid AND job_id = $1::uuid AND removed_at IS NULL
       RETURNING party_id`,
      [jobId, partyId, removedBy],
    );
    return result.rows.length > 0;
  }

  async addShipmentReference(reference: {
    jobId: string;
    kind: ReferenceKind;
    value: string;
    sealNumber: string | null;
    parentReferenceId: string | null;
    createdBy: string;
  }): Promise<
    ShipmentReferenceRecord | "parent_invalid" | "duplicate_reference"
  > {
    try {
      const result = await this.pool.query(
        `INSERT INTO app.shipment_reference
          (job_id, kind, reference_value, seal_number, parent_reference_id, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::uuid) RETURNING *`,
        [
          reference.jobId,
          reference.kind,
          reference.value,
          reference.sealNumber,
          reference.parentReferenceId,
          reference.createdBy,
        ],
      );
      return this.mapReference(result.rows[0]);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") return "duplicate_reference";
      if ((error as Error).message?.includes("active master of the same job")) {
        return "parent_invalid";
      }
      throw error;
    }
  }

  async listShipmentReferences(
    jobId: string,
  ): Promise<ShipmentReferenceRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM app.shipment_reference
       WHERE job_id = $1::uuid AND removed_at IS NULL
       ORDER BY created_at, reference_id`,
      [jobId],
    );
    return result.rows.map((row) => this.mapReference(row));
  }

  async removeShipmentReference(
    jobId: string,
    referenceId: string,
    removedBy: string,
  ): Promise<boolean | "has_children"> {
    const children = await this.pool.query(
      `SELECT 1 FROM app.shipment_reference
       WHERE parent_reference_id = $1::uuid AND removed_at IS NULL`,
      [referenceId],
    );
    if (children.rows.length > 0) return "has_children";
    const result = await this.pool.query(
      `UPDATE app.shipment_reference
       SET removed_by = $3::uuid, removed_at = clock_timestamp()
       WHERE reference_id = $2::uuid AND job_id = $1::uuid AND removed_at IS NULL
       RETURNING reference_id`,
      [jobId, referenceId, removedBy],
    );
    return result.rows.length > 0;
  }

  private mapParty(row: Record<string, unknown>): JobPartyRecord {
    return {
      id: String(row.party_id),
      jobId: String(row.job_id),
      role: row.role as PartyRole,
      name: String(row.party_name),
      details: row.details ? String(row.details) : null,
      createdBy: String(row.created_by),
      createdAt: this.toIsoString(row.created_at),
    };
  }

  private mapReference(row: Record<string, unknown>): ShipmentReferenceRecord {
    return {
      id: String(row.reference_id),
      jobId: String(row.job_id),
      kind: row.kind as ReferenceKind,
      value: String(row.reference_value),
      sealNumber: row.seal_number ? String(row.seal_number) : null,
      parentReferenceId: row.parent_reference_id
        ? String(row.parent_reference_id)
        : null,
      createdBy: String(row.created_by),
      createdAt: this.toIsoString(row.created_at),
    };
  }

  async saveDocumentVersion(upload: {
    jobId: string;
    documentId: string | null;
    documentType: DocumentType;
    filename: string;
    contentType: string;
    sizeBytes: number;
    sha256: string;
    objectKey: string;
    uploadedBy: string;
  }): Promise<DocumentRecord | "document_not_found"> {
    const documentId = await this.insertDocumentVersion(upload);
    if (documentId === "document_not_found") return documentId;
    const documents = await this.listDocuments(upload.jobId);
    return documents.find((document) => document.id === documentId)!;
  }

  private async insertDocumentVersion(upload: {
    jobId: string;
    documentId: string | null;
    documentType: DocumentType;
    filename: string;
    contentType: string;
    sizeBytes: number;
    sha256: string;
    objectKey: string;
    uploadedBy: string;
  }): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      let documentId = upload.documentId;
      if (documentId) {
        const existing = await client.query(
          `SELECT document_id FROM app.document
           WHERE document_id = $1::uuid AND job_id = $2::uuid FOR UPDATE`,
          [documentId, upload.jobId],
        );
        if (existing.rows.length === 0) {
          await client.query("ROLLBACK");
          return "document_not_found";
        }
      } else {
        const created = await client.query(
          `INSERT INTO app.document (job_id, document_type, created_by)
           VALUES ($1::uuid, $2, $3::uuid) RETURNING document_id`,
          [upload.jobId, upload.documentType, upload.uploadedBy],
        );
        documentId = String(created.rows[0].document_id);
      }
      await client.query(
        `INSERT INTO app.document_version
          (document_id, version_number, original_filename, content_type,
           size_bytes, sha256, object_key, uploaded_by)
         VALUES ($1::uuid,
           (SELECT COALESCE(MAX(version_number), 0) + 1
            FROM app.document_version WHERE document_id = $1::uuid),
           $2, $3, $4, $5, $6, $7::uuid)`,
        [
          documentId,
          upload.filename,
          upload.contentType,
          upload.sizeBytes,
          upload.sha256,
          upload.objectKey,
          upload.uploadedBy,
        ],
      );
      await client.query("COMMIT");
      return documentId;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listDocuments(jobId: string): Promise<DocumentRecord[]> {
    const documents = await this.pool.query(
      `SELECT * FROM app.document WHERE job_id = $1::uuid ORDER BY created_at, document_id`,
      [jobId],
    );
    const versions = await this.pool.query(
      `SELECT version.* FROM app.document_version AS version
       JOIN app.document AS document ON document.document_id = version.document_id
       WHERE document.job_id = $1::uuid
       ORDER BY version.document_id, version.version_number`,
      [jobId],
    );
    return documents.rows.map((row) => ({
      id: String(row.document_id),
      jobId: String(row.job_id),
      documentType: row.document_type as DocumentType,
      createdBy: String(row.created_by),
      createdAt: this.toIsoString(row.created_at),
      versions: versions.rows
        .filter((version) => version.document_id === row.document_id)
        .map((version) => this.mapDocumentVersion(version)),
    }));
  }

  async findDocumentVersion(
    jobId: string,
    documentId: string,
    versionNumber?: number,
  ): Promise<StoredDocumentVersion | null> {
    const result = await this.pool.query(
      `SELECT version.* FROM app.document_version AS version
       JOIN app.document AS document ON document.document_id = version.document_id
       WHERE document.document_id = $1::uuid AND document.job_id = $2::uuid
         AND ($3::int IS NULL OR version.version_number = $3::int)
       ORDER BY version.version_number DESC LIMIT 1`,
      [documentId, jobId, versionNumber ?? null],
    );
    const row = result.rows[0];
    return row
      ? {
          ...this.mapDocumentVersion(row),
          objectKey: String(row.object_key),
          documentId: String(row.document_id),
        }
      : null;
  }

  private mapDocumentVersion(
    row: Record<string, unknown>,
  ): DocumentVersionRecord {
    return {
      id: String(row.version_id),
      versionNumber: Number(row.version_number),
      filename: String(row.original_filename),
      contentType: String(row.content_type),
      sizeBytes: Number(row.size_bytes),
      sha256: String(row.sha256),
      uploadedBy: String(row.uploaded_by),
      uploadedAt: this.toIsoString(row.uploaded_at),
    };
  }

  async changeJobStatus(change: {
    jobId: string;
    from: JobStatus;
    to: JobStatus;
    reason: string | null;
    changedBy: string;
  }): Promise<JobRecord | "status_changed"> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE app.job
         SET status = $3,
             closed_at = CASE WHEN $3 IN ('closed', 'cancelled') THEN now() ELSE NULL END
         WHERE job_id = $1::uuid AND status = $2
         RETURNING job_id`,
        [change.jobId, change.from, change.to],
      );
      if (updated.rows.length === 0) {
        await client.query("ROLLBACK");
        return "status_changed";
      }
      await client.query(
        `INSERT INTO app.job_status_history
          (job_id, from_status, to_status, reason, changed_by)
         VALUES ($1::uuid, $2, $3, $4, $5::uuid)`,
        [change.jobId, change.from, change.to, change.reason, change.changedBy],
      );
      const job = await client.query(
        `${jobSelect} WHERE job.job_id = $1::uuid`,
        [change.jobId],
      );
      await client.query("COMMIT");
      return this.mapJob(job.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listJobStatusHistory(jobId: string): Promise<JobStatusChangeRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM app.job_status_history
       WHERE job_id = $1::uuid ORDER BY changed_at, history_id`,
      [jobId],
    );
    return result.rows.map((row) => ({
      id: String(row.history_id),
      jobId: String(row.job_id),
      fromStatus: row.from_status as JobStatus,
      toStatus: row.to_status as JobStatus,
      reason: row.reason ? String(row.reason) : null,
      changedBy: String(row.changed_by),
      changedAt: this.toIsoString(row.changed_at),
    }));
  }

  async appendMilestoneEvent(event: {
    jobId: string;
    milestoneKey: string;
    occurredAt: string;
    recordedBy: string;
    note: string | null;
    correctionOf: string | null;
  }): Promise<MilestoneEventRecord | "correction_target_not_found"> {
    if (event.correctionOf) {
      const target = await this.pool.query(
        `SELECT 1 FROM app.milestone_event
         WHERE event_id = $1::uuid AND job_id = $2::uuid`,
        [event.correctionOf, event.jobId],
      );
      if (target.rows.length === 0) return "correction_target_not_found";
    }
    const result = await this.pool.query(
      `INSERT INTO app.milestone_event
        (job_id, milestone_key, occurred_at, recorded_by, note, correction_of)
       VALUES ($1::uuid, $2, $3::timestamptz, $4::uuid, $5, $6::uuid)
       RETURNING *`,
      [
        event.jobId,
        event.milestoneKey,
        event.occurredAt,
        event.recordedBy,
        event.note,
        event.correctionOf,
      ],
    );
    return this.mapMilestoneEvent(result.rows[0]);
  }

  async listMilestoneEvents(jobId: string): Promise<MilestoneEventRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM app.milestone_event
       WHERE job_id = $1::uuid ORDER BY occurred_at, recorded_at, event_id`,
      [jobId],
    );
    return result.rows.map((row) => this.mapMilestoneEvent(row));
  }

  private mapMilestoneEvent(
    row: Record<string, unknown>,
  ): MilestoneEventRecord {
    return {
      id: String(row.event_id),
      jobId: String(row.job_id),
      milestoneKey: String(row.milestone_key),
      occurredAt: this.toIsoString(row.occurred_at),
      recordedAt: this.toIsoString(row.recorded_at),
      recordedBy: String(row.recorded_by),
      source: row.source as MilestoneEventRecord["source"],
      note: row.note ? String(row.note) : null,
      correctionOf: row.correction_of ? String(row.correction_of) : null,
    };
  }

  async appendEtaEvent(event: {
    jobId: string;
    etaAt: string;
    source: string;
    note: string | null;
    recordedBy: string;
    correctionOf: string | null;
  }): Promise<EtaEventRecord | "correction_target_not_found"> {
    if (event.correctionOf) {
      const target = await this.pool.query(
        `SELECT 1 FROM app.eta_event
         WHERE eta_id = $1::uuid AND job_id = $2::uuid`,
        [event.correctionOf, event.jobId],
      );
      if (target.rows.length === 0) return "correction_target_not_found";
    }
    const result = await this.pool.query(
      `INSERT INTO app.eta_event
        (job_id, eta_at, source, note, recorded_by, correction_of)
       VALUES ($1::uuid, $2::timestamptz, $3, $4, $5::uuid, $6::uuid)
       RETURNING *`,
      [
        event.jobId,
        event.etaAt,
        event.source,
        event.note,
        event.recordedBy,
        event.correctionOf,
      ],
    );
    return this.mapEtaEvent(result.rows[0]);
  }

  async listEtaEvents(jobId: string): Promise<EtaEventRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM app.eta_event
       WHERE job_id = $1::uuid ORDER BY recorded_at, eta_id`,
      [jobId],
    );
    return result.rows.map((row) => this.mapEtaEvent(row));
  }

  private mapEtaEvent(row: Record<string, unknown>): EtaEventRecord {
    return {
      id: String(row.eta_id),
      jobId: String(row.job_id),
      etaAt: this.toIsoString(row.eta_at),
      source: String(row.source),
      note: row.note ? String(row.note) : null,
      recordedAt: this.toIsoString(row.recorded_at),
      recordedBy: String(row.recorded_by),
      correctionOf: row.correction_of ? String(row.correction_of) : null,
    };
  }

  async createJobTask(task: {
    jobId: string;
    kind: TaskKind;
    title: string;
    details: string | null;
    assignedRole: StaffRoleKey;
    dueDate: string | null;
    createdBy: string;
  }): Promise<JobTaskRecord> {
    const result = await this.pool.query(
      `WITH inserted AS (
         INSERT INTO app.job_task
           (job_id, kind, title, details, assigned_role, due_date, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::date, $7::uuid)
         RETURNING *)
       ${jobTaskSelect("inserted")}`,
      [
        task.jobId,
        task.kind,
        task.title,
        task.details,
        task.assignedRole,
        task.dueDate,
        task.createdBy,
      ],
    );
    return this.mapJobTask(result.rows[0]);
  }

  async listJobTasks(
    filter: { jobId?: string; assignedRole?: StaffRoleKey; open?: boolean },
    scope: JobScope,
  ): Promise<JobTaskRecord[]> {
    if (scope.companyIds?.length === 0 || scope.serviceLines?.length === 0) {
      return [];
    }
    const result = await this.pool.query(
      `${jobTaskSelect("app.job_task")}
       WHERE ($1::uuid IS NULL OR task.job_id = $1::uuid)
         AND ($2::text IS NULL OR task.assigned_role = $2)
         AND (NOT $3::boolean OR task.status = 'open')
         AND ($4::uuid[] IS NULL OR job.customer_company_id = ANY($4::uuid[]))
         AND ($5::text[] IS NULL OR job.service_line = ANY($5::text[]))
       ORDER BY (task.status = 'done'), task.due_date NULLS LAST,
         task.created_at, task.task_id`,
      [
        filter.jobId ?? null,
        filter.assignedRole ?? null,
        filter.open ?? false,
        scope.companyIds ?? null,
        scope.serviceLines ?? null,
      ],
    );
    return result.rows.map((row) => this.mapJobTask(row));
  }

  async completeJobTask(
    jobId: string,
    taskId: string,
    completedBy: string,
    note: string | null,
  ): Promise<JobTaskRecord | "not_found" | "already_done"> {
    const updated = await this.pool.query(
      `WITH updated AS (
         UPDATE app.job_task
         SET status = 'done', completed_at = clock_timestamp(),
             completed_by = $3::uuid, completion_note = $4
         WHERE task_id = $2::uuid AND job_id = $1::uuid AND status = 'open'
         RETURNING *)
       ${jobTaskSelect("updated")}`,
      [jobId, taskId, completedBy, note],
    );
    if (updated.rows.length > 0) return this.mapJobTask(updated.rows[0]);
    const existing = await this.pool.query(
      `SELECT 1 FROM app.job_task WHERE task_id = $2::uuid AND job_id = $1::uuid`,
      [jobId, taskId],
    );
    return existing.rows.length > 0 ? "already_done" : "not_found";
  }

  private mapJobTask(row: Record<string, unknown>): JobTaskRecord {
    return {
      id: String(row.task_id),
      jobId: String(row.job_id),
      fileNumber: String(row.file_number),
      customerCompanyName: String(row.company_name),
      kind: row.kind as TaskKind,
      title: String(row.title),
      details: row.details ? String(row.details) : null,
      assignedRole: row.assigned_role as StaffRoleKey,
      dueDate: row.due_date ? String(row.due_date) : null,
      status: row.status as "open" | "done",
      createdAt: this.toIsoString(row.created_at),
      createdBy: String(row.created_by),
      completedAt: row.completed_at ? this.toIsoString(row.completed_at) : null,
      completedBy: row.completed_by ? String(row.completed_by) : null,
      completionNote: row.completion_note ? String(row.completion_note) : null,
    };
  }

  async createQuote(
    input: {
      customerCompanyId: string;
      serviceLine: ServiceLine;
      quoteRequestId: string | null;
      version: QuoteVersionInput;
    },
    createdBy: string,
  ): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const quote = await client.query(
        `INSERT INTO app.quote
          (service_line, customer_company_id, quote_request_id, created_by)
         VALUES ($1, $2::uuid, $3::uuid, $4::uuid)
         RETURNING quote_id`,
        [
          input.serviceLine,
          input.customerCompanyId,
          input.quoteRequestId,
          createdBy,
        ],
      );
      const quoteId = String(quote.rows[0].quote_id);
      const version = await client.query(
        `INSERT INTO app.quote_version
          (quote_id, version_number, currency, title, subtitle, shipment_scope,
           intro, at_cost_note, procedure_steps, required_documents,
           documents_note, timeline, terms, created_by)
         VALUES ($1::uuid, 1, $2, $3, $4, $5, $6, $7, $8::text[], $9::text[],
           $10, $11, $12::text[], $13::uuid)
         RETURNING version_id`,
        [quoteId, ...quoteVersionValues(input.version), createdBy],
      );
      await this.insertQuoteLines(
        client,
        String(version.rows[0].version_id),
        input.version,
      );
      await client.query("COMMIT");
      return quoteId;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listQuotes(scope: JobScope): Promise<QuoteSummaryRecord[]> {
    if (scope.companyIds?.length === 0 || scope.serviceLines?.length === 0) {
      return [];
    }
    const result = await this.pool.query(
      `SELECT quote.*, company.company_name,
         version.version_number, version.status, version.title, version.currency
       FROM app.quote AS quote
       JOIN app.customer_company AS company
         ON company.company_id = quote.customer_company_id
       JOIN LATERAL (
         SELECT * FROM app.quote_version AS candidate
         WHERE candidate.quote_id = quote.quote_id
           AND (NOT $1::boolean OR candidate.status = 'issued')
         ORDER BY candidate.version_number DESC LIMIT 1
       ) AS version ON true
       WHERE ($2::uuid[] IS NULL OR quote.customer_company_id = ANY($2::uuid[]))
         AND ($3::text[] IS NULL OR quote.service_line = ANY($3::text[]))
       ORDER BY quote.created_at DESC, quote.quote_id`,
      [
        scope.companyIds !== undefined,
        scope.companyIds ?? null,
        scope.serviceLines ?? null,
      ],
    );
    return result.rows.map((row) => ({
      ...this.mapQuoteHead(row),
      latestVersionNumber: Number(row.version_number),
      latestStatus: row.status as "draft" | "issued",
      title: String(row.title),
      currency: String(row.currency),
    }));
  }

  async findQuote(id: string, scope: JobScope): Promise<QuoteRecord | null> {
    if (scope.companyIds?.length === 0 || scope.serviceLines?.length === 0) {
      return null;
    }
    const head = await this.pool.query(
      `SELECT quote.*, company.company_name
       FROM app.quote AS quote
       JOIN app.customer_company AS company
         ON company.company_id = quote.customer_company_id
       WHERE quote.quote_id = $1::uuid
         AND ($2::uuid[] IS NULL OR quote.customer_company_id = ANY($2::uuid[]))
         AND ($3::text[] IS NULL OR quote.service_line = ANY($3::text[]))`,
      [id, scope.companyIds ?? null, scope.serviceLines ?? null],
    );
    if (head.rows.length === 0) return null;
    const versions = await this.pool.query(
      `SELECT * FROM app.quote_version
       WHERE quote_id = $1::uuid AND (NOT $2::boolean OR status = 'issued')
       ORDER BY version_number`,
      [id, scope.companyIds !== undefined],
    );
    if (versions.rows.length === 0 && scope.companyIds !== undefined) {
      return null;
    }
    const lines = await this.pool.query(
      `SELECT line.* FROM app.quote_line AS line
       JOIN app.quote_version AS version ON version.version_id = line.version_id
       WHERE version.quote_id = $1::uuid
       ORDER BY line.version_id, line.position`,
      [id],
    );
    const decisions = await this.pool.query(
      `SELECT decision.*, version.version_number
       FROM app.quote_decision AS decision
       JOIN app.quote_version AS version
         ON version.version_id = decision.version_id
       WHERE decision.quote_id = $1::uuid
       ORDER BY decision.recorded_at, decision.decision_id`,
      [id],
    );
    const job = await this.pool.query(
      "SELECT job_id FROM app.job WHERE quote_id = $1::uuid",
      [id],
    );
    return {
      ...this.mapQuoteHead(head.rows[0]),
      versions: versions.rows.map((row) =>
        this.mapQuoteVersion(
          row,
          lines.rows.filter((line) => line.version_id === row.version_id),
        ),
      ),
      decisions: decisions.rows.map((row) => this.mapQuoteDecision(row)),
      jobId: job.rows.length > 0 ? String(job.rows[0].job_id) : null,
    };
  }

  async decideQuote(input: {
    quoteId: string;
    versionNumber: number;
    decision: QuoteDecision;
    clientSignatory: string;
    decidedAt: string;
    note: string | null;
    recordedBy: string;
    year: number;
  }): Promise<
    | { decision: QuoteDecisionRecord; job: JobRecord | null }
    | "version_not_found"
    | "not_issued"
    | "not_latest"
    | "already_decided"
  > {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialises concurrent decisions on the same quote.
      const quote = await client.query(
        `SELECT service_line, customer_company_id, quote_request_id
         FROM app.quote WHERE quote_id = $1::uuid FOR UPDATE`,
        [input.quoteId],
      );
      const version = await client.query(
        `SELECT version_id, status FROM app.quote_version
         WHERE quote_id = $1::uuid AND version_number = $2::integer`,
        [input.quoteId, input.versionNumber],
      );
      if (version.rows.length === 0) {
        await client.query("ROLLBACK");
        return "version_not_found";
      }
      if (version.rows[0].status !== "issued") {
        await client.query("ROLLBACK");
        return "not_issued";
      }
      const versionId = String(version.rows[0].version_id);

      const existing = await client.query(
        `SELECT decision.*, $2::integer AS version_number
         FROM app.quote_decision AS decision
         WHERE decision.version_id = $1::uuid`,
        [versionId, input.versionNumber],
      );
      if (existing.rows.length > 0) {
        const replay =
          existing.rows[0].decision === input.decision
            ? {
                decision: this.mapQuoteDecision(existing.rows[0]),
                job: await this.findJobForQuote(client, input.quoteId),
              }
            : ("already_decided" as const);
        await client.query("ROLLBACK");
        return replay;
      }

      const latest = await client.query(
        `SELECT max(version_number) AS latest FROM app.quote_version
         WHERE quote_id = $1::uuid AND status = 'issued'`,
        [input.quoteId],
      );
      if (Number(latest.rows[0].latest) !== input.versionNumber) {
        await client.query("ROLLBACK");
        return "not_latest";
      }

      const inserted = await client.query(
        `INSERT INTO app.quote_decision
          (quote_id, version_id, decision, client_signatory, decided_at, note, recorded_by)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6, $7::uuid)
         RETURNING *, $8::integer AS version_number`,
        [
          input.quoteId,
          versionId,
          input.decision,
          input.clientSignatory,
          input.decidedAt,
          input.note,
          input.recordedBy,
          input.versionNumber,
        ],
      );

      let job: JobRecord | null = null;
      if (input.decision === "accepted") {
        const allocated = await client.query(
          "SELECT app.allocate_job_number($1, $2) AS file_number",
          [String(quote.rows[0].service_line), input.year],
        );
        const created = await client.query(
          `INSERT INTO app.job
            (file_number, service_line, customer_company_id, quote_request_id, quote_id, opened_by)
           VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6::uuid)
           RETURNING job_id`,
          [
            String(allocated.rows[0].file_number),
            String(quote.rows[0].service_line),
            String(quote.rows[0].customer_company_id),
            quote.rows[0].quote_request_id
              ? String(quote.rows[0].quote_request_id)
              : null,
            input.quoteId,
            input.recordedBy,
          ],
        );
        const row = await client.query(
          `${jobSelect} WHERE job.job_id = $1::uuid`,
          [String(created.rows[0].job_id)],
        );
        job = this.mapJob(row.rows[0]);
      }
      await client.query("COMMIT");
      return { decision: this.mapQuoteDecision(inserted.rows[0]), job };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async findJobForQuote(
    client: PostgresClient,
    quoteId: string,
  ): Promise<JobRecord | null> {
    const result = await client.query(
      `${jobSelect} WHERE job.quote_id = $1::uuid`,
      [quoteId],
    );
    return result.rows.length > 0 ? this.mapJob(result.rows[0]) : null;
  }

  private mapQuoteDecision(row: Record<string, unknown>): QuoteDecisionRecord {
    return {
      id: String(row.decision_id),
      versionNumber: Number(row.version_number),
      decision: row.decision as QuoteDecision,
      clientSignatory: String(row.client_signatory),
      decidedAt: this.toIsoString(row.decided_at),
      note: row.note ? String(row.note) : null,
      recordedAt: this.toIsoString(row.recorded_at),
      recordedBy: String(row.recorded_by),
    };
  }

  async saveQuoteVersionDraft(
    quoteId: string,
    content: QuoteVersionInput,
  ): Promise<"saved" | "no_draft"> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const draft = await client.query(
        `SELECT version_id FROM app.quote_version
         WHERE quote_id = $1::uuid AND status = 'draft' FOR UPDATE`,
        [quoteId],
      );
      if (draft.rows.length === 0) {
        await client.query("ROLLBACK");
        return "no_draft";
      }
      const versionId = String(draft.rows[0].version_id);
      await client.query(
        `UPDATE app.quote_version
         SET currency = $2, title = $3, subtitle = $4, shipment_scope = $5,
             intro = $6, at_cost_note = $7, procedure_steps = $8::text[],
             required_documents = $9::text[], documents_note = $10,
             timeline = $11, terms = $12::text[], updated_at = clock_timestamp()
         WHERE version_id = $1::uuid`,
        [versionId, ...quoteVersionValues(content)],
      );
      await client.query(
        "DELETE FROM app.quote_line WHERE version_id = $1::uuid",
        [versionId],
      );
      await this.insertQuoteLines(client, versionId, content);
      await client.query("COMMIT");
      return "saved";
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async startQuoteVersion(
    quoteId: string,
    createdBy: string,
  ): Promise<"started" | "draft_exists"> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT 1 FROM app.quote WHERE quote_id = $1::uuid FOR UPDATE",
        [quoteId],
      );
      const draft = await client.query(
        "SELECT 1 FROM app.quote_version WHERE quote_id = $1::uuid AND status = 'draft'",
        [quoteId],
      );
      if (draft.rows.length > 0) {
        await client.query("ROLLBACK");
        return "draft_exists";
      }
      const copied = await client.query(
        `INSERT INTO app.quote_version
          (quote_id, version_number, currency, title, subtitle, shipment_scope,
           intro, at_cost_note, procedure_steps, required_documents,
           documents_note, timeline, terms, created_by)
         SELECT quote_id, version_number + 1, currency, title, subtitle,
           shipment_scope, intro, at_cost_note, procedure_steps,
           required_documents, documents_note, timeline, terms, $2::uuid
         FROM app.quote_version WHERE quote_id = $1::uuid
         ORDER BY version_number DESC LIMIT 1
         RETURNING version_id, version_number`,
        [quoteId, createdBy],
      );
      await client.query(
        `INSERT INTO app.quote_line
          (version_id, position, section, description, basis, basis_note,
           amount_minor, amount_20ft_minor, amount_40ft_minor)
         SELECT $2::uuid, position, section, description, basis, basis_note,
           amount_minor, amount_20ft_minor, amount_40ft_minor
         FROM app.quote_line
         WHERE version_id = (
           SELECT version_id FROM app.quote_version
           WHERE quote_id = $1::uuid AND version_number = $3::integer - 1)`,
        [
          quoteId,
          String(copied.rows[0].version_id),
          Number(copied.rows[0].version_number),
        ],
      );
      await client.query("COMMIT");
      return "started";
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async issueQuoteVersion(
    quoteId: string,
    issuedBy: string,
    year: number,
  ): Promise<"issued" | "no_draft" | "no_lines"> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const quote = await client.query(
        `SELECT quote_number, service_line FROM app.quote
         WHERE quote_id = $1::uuid FOR UPDATE`,
        [quoteId],
      );
      const draft = await client.query(
        `SELECT version_id,
           EXISTS (SELECT 1 FROM app.quote_line
                   WHERE version_id = quote_version.version_id) AS has_lines
         FROM app.quote_version
         WHERE quote_id = $1::uuid AND status = 'draft'`,
        [quoteId],
      );
      if (draft.rows.length === 0) {
        await client.query("ROLLBACK");
        return "no_draft";
      }
      if (!draft.rows[0].has_lines) {
        await client.query("ROLLBACK");
        return "no_lines";
      }
      if (!quote.rows[0].quote_number) {
        const allocated = await client.query(
          `SELECT app.allocate_quote_number($1, $2, COALESCE(
             (SELECT settings #>> '{numbering,quotePrefix}'
              FROM app.business_settings_revision
              ORDER BY revision_number DESC LIMIT 1), 'BJH/Q')) AS quote_number`,
          [String(quote.rows[0].service_line), year],
        );
        await client.query(
          "UPDATE app.quote SET quote_number = $2 WHERE quote_id = $1::uuid",
          [quoteId, String(allocated.rows[0].quote_number)],
        );
      }
      await client.query(
        `UPDATE app.quote_version
         SET status = 'issued', issued_by = $2::uuid,
             issued_at = clock_timestamp(), updated_at = clock_timestamp()
         WHERE version_id = $1::uuid`,
        [String(draft.rows[0].version_id), issuedBy],
      );
      await client.query("COMMIT");
      return "issued";
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertQuoteLines(
    client: PostgresClient,
    versionId: string,
    content: QuoteVersionInput,
  ): Promise<void> {
    for (const [position, line] of content.lines.entries()) {
      await client.query(
        `INSERT INTO app.quote_line
          (version_id, position, section, description, basis, basis_note,
           amount_minor, amount_20ft_minor, amount_40ft_minor)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          versionId,
          position,
          line.section,
          line.description,
          line.basis,
          line.basisNote,
          line.amountMinor,
          line.amount20ftMinor,
          line.amount40ftMinor,
        ],
      );
    }
  }

  private mapQuoteHead(
    row: Record<string, unknown>,
  ): Omit<QuoteRecord, "versions" | "decisions" | "jobId"> {
    return {
      id: String(row.quote_id),
      quoteNumber: row.quote_number ? String(row.quote_number) : null,
      serviceLine: row.service_line as ServiceLine,
      customerCompanyId: String(row.customer_company_id),
      customerCompanyName: String(row.company_name),
      quoteRequestId: row.quote_request_id
        ? String(row.quote_request_id)
        : null,
      createdBy: String(row.created_by),
      createdAt: this.toIsoString(row.created_at),
    };
  }

  private mapQuoteVersion(
    row: Record<string, unknown>,
    lines: Array<Record<string, unknown>>,
  ): QuoteVersionRecord {
    const optional = (value: unknown) => (value ? String(value) : null);
    const minor = (value: unknown) =>
      value === null || value === undefined ? null : Number(value);
    return {
      id: String(row.version_id),
      versionNumber: Number(row.version_number),
      status: row.status as "draft" | "issued",
      currency: String(row.currency),
      title: String(row.title),
      subtitle: optional(row.subtitle),
      shipmentScope: optional(row.shipment_scope),
      intro: optional(row.intro),
      atCostNote: optional(row.at_cost_note),
      procedureSteps: row.procedure_steps as string[],
      requiredDocuments: row.required_documents as string[],
      documentsNote: optional(row.documents_note),
      timeline: optional(row.timeline),
      terms: row.terms as string[],
      createdBy: String(row.created_by),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
      issuedBy: optional(row.issued_by),
      issuedAt: row.issued_at ? this.toIsoString(row.issued_at) : null,
      lines: lines.map((line): QuoteLineRecord => ({
        id: String(line.line_id),
        position: Number(line.position),
        section: optional(line.section),
        description: String(line.description),
        basis: line.basis as QuoteBasis,
        basisNote: optional(line.basis_note),
        amountMinor: minor(line.amount_minor),
        amount20ftMinor: minor(line.amount_20ft_minor),
        amount40ftMinor: minor(line.amount_40ft_minor),
      })),
    };
  }

  async getBusinessSettings(): Promise<BusinessSettingsRevisionRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM app.business_settings_revision
       ORDER BY revision_number DESC LIMIT 1`,
    );
    return result.rows.length > 0
      ? this.mapSettingsRevision(result.rows[0])
      : null;
  }

  async listBusinessSettingsRevisions(): Promise<
    BusinessSettingsRevisionRecord[]
  > {
    const result = await this.pool.query(
      `SELECT * FROM app.business_settings_revision
       ORDER BY revision_number DESC`,
    );
    return result.rows.map((row) => this.mapSettingsRevision(row));
  }

  async saveBusinessSettings(
    settings: BusinessSettings,
    changedBy: string,
  ): Promise<BusinessSettingsRevisionRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialises writers so revision numbers never collide.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('app.business_settings_revision'))",
      );
      const result = await client.query(
        `INSERT INTO app.business_settings_revision
          (revision_number, settings, changed_by)
         SELECT COALESCE(max(revision_number), 0) + 1, $1::jsonb, $2::uuid
         FROM app.business_settings_revision
         RETURNING *`,
        [JSON.stringify(settings), changedBy],
      );
      await client.query("COMMIT");
      return this.mapSettingsRevision(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private mapSettingsRevision(
    row: Record<string, unknown>,
  ): BusinessSettingsRevisionRecord {
    return {
      revisionNumber: Number(row.revision_number),
      settings: row.settings as BusinessSettings,
      changedBy: String(row.changed_by),
      changedAt: this.toIsoString(row.changed_at),
    };
  }

  async recordActivity(entry: ActivityEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO app.activity_log
        (actor_user_id, actor_email, method, route, entity_id, status_code, client_ip)
       VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6, $7)`,
      [
        entry.actorUserId,
        entry.actorEmail,
        entry.method,
        entry.route,
        entry.entityId,
        entry.statusCode,
        entry.clientIp,
      ],
    );
  }

  async listActivity(filter: ActivityFilter): Promise<ActivityRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM app.activity_log
       WHERE ($1::uuid IS NULL OR actor_user_id = $1::uuid)
         AND ($2::uuid IS NULL OR entity_id = $2::uuid)
         AND ($3::timestamptz IS NULL OR occurred_at >= $3::timestamptz)
         AND ($4::timestamptz IS NULL OR occurred_at <= $4::timestamptz)
       ORDER BY occurred_at DESC, activity_id DESC
       LIMIT $5 OFFSET $6`,
      [
        filter.actorUserId ?? null,
        filter.entityId ?? null,
        filter.from ?? null,
        filter.to ?? null,
        filter.limit,
        filter.offset,
      ],
    );
    return result.rows.map((row) => ({
      id: String(row.activity_id),
      occurredAt: this.toIsoString(row.occurred_at),
      actorUserId: String(row.actor_user_id),
      actorEmail: row.actor_email ? String(row.actor_email) : null,
      method: String(row.method),
      route: String(row.route),
      entityId: row.entity_id ? String(row.entity_id) : null,
      statusCode: Number(row.status_code),
      clientIp: row.client_ip ? String(row.client_ip) : null,
    }));
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
