import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  departmentAssignmentInputSchema,
  parseContract,
  quoteDraftInputSchema,
  quoteRequestInputSchema,
  type QuoteRequestInput,
} from "@bjh/contracts";
import { randomUUID } from "node:crypto";
import {
  DatabasePort,
  DepartmentRoleKey,
  QuoteDraftRecord,
  QuoteRequestRecord,
} from "../database/database.port";

@Injectable()
export class QuoteRequestsService {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async create(input: unknown): Promise<QuoteRequestRecord> {
    const details = this.validate(input);

    return this.database.createQuoteRequest({
      id: randomUUID(),
      ...details,
      createdAt: new Date().toISOString(),
      customerCompanyId: null,
      customerCompanyName: null,
      quoteDraftRevisionCount: 0,
      quoteDraftUpdatedAt: null,
    });
  }

  list(
    customerCompanyId?: unknown,
    allowedCompanyIds?: string[],
  ): Promise<QuoteRequestRecord[]> {
    if (
      customerCompanyId !== undefined &&
      typeof customerCompanyId !== "string"
    ) {
      throw new BadRequestException("customerCompanyId must be a string");
    }

    return this.database.listQuoteRequests(
      customerCompanyId,
      allowedCompanyIds,
    );
  }

  async get(
    id: string,
    allowedCompanyIds?: string[],
  ): Promise<QuoteRequestRecord> {
    const request = await this.database.findQuoteRequest(id, allowedCompanyIds);
    if (!request) {
      throw new NotFoundException("Quote request was not found");
    }
    return request;
  }

  async associateCustomer(
    requestId: string,
    input: unknown,
  ): Promise<QuoteRequestRecord> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("A customer company ID is required");
    }

    const customerCompanyId = (input as Record<string, unknown>)
      .customerCompanyId;
    if (typeof customerCompanyId !== "string" || !customerCompanyId.trim()) {
      throw new BadRequestException("customerCompanyId is required");
    }

    const customer = await this.database.findCustomer(customerCompanyId);
    if (!customer) {
      throw new NotFoundException("Customer company was not found");
    }

    const request = await this.database.linkQuoteRequestToCustomer(
      requestId,
      customer.id,
    );
    if (!request) {
      throw new NotFoundException("Quote request was not found");
    }

    return request;
  }

  async getDepartmentAssignment(
    requestId: string,
  ): Promise<DepartmentRoleKey | null> {
    const role = await this.database.getQuoteRequestDepartment(requestId);
    if (role === undefined)
      throw new NotFoundException("Quote request was not found");
    return role;
  }

  async assignDepartment(
    requestId: string,
    input: unknown,
    assignedBy: string,
  ): Promise<{ roleKey: DepartmentRoleKey | null }> {
    const parsed = parseContract(departmentAssignmentInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const { roleKey } = parsed.data;
    const result = await this.database.assignQuoteRequestDepartment(
      requestId,
      roleKey,
      assignedBy,
      new Date().toISOString(),
    );
    if (result === undefined)
      throw new NotFoundException("Quote request was not found");
    return { roleKey: result };
  }

  async getDraft(
    requestId: string,
    allowedCompanyIds?: string[],
  ): Promise<QuoteDraftRecord | null> {
    await this.requireAssociatedRequest(requestId, allowedCompanyIds);
    return this.database.findQuoteDraft(requestId);
  }

  async saveDraft(
    requestId: string,
    input: unknown,
    savedBy: string,
  ): Promise<QuoteDraftRecord> {
    await this.requireAssociatedRequest(requestId);
    const parsed = parseContract(quoteDraftInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const { content } = parsed.data;

    return this.database.saveQuoteDraft(
      requestId,
      content,
      savedBy,
      new Date().toISOString(),
    );
  }

  private async requireAssociatedRequest(
    requestId: string,
    allowedCompanyIds?: string[],
  ): Promise<QuoteRequestRecord> {
    const request = await this.get(requestId, allowedCompanyIds);
    if (!request.customerCompanyId) {
      throw new ConflictException(
        "Link the quote request to a customer company before drafting",
      );
    }
    return request;
  }

  private validate(input: unknown): QuoteRequestInput {
    const result = parseContract(quoteRequestInputSchema, input);
    if (!result.success) throw new BadRequestException(result.message);
    return result.data;
  }
}
