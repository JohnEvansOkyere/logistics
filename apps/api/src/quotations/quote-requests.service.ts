import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  parseContract,
  portalQuoteRequestInputSchema,
  quoteRequestInputSchema,
  type QuoteRequestInput,
} from "@bjh/contracts";
import { randomUUID } from "node:crypto";
import { DatabasePort, QuoteRequestRecord } from "../database/database.port";

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
      quoteId: null,
      quoteNumber: null,
      quoteStatus: null,
    });
  }

  /**
   * A customer's own request. The company comes from the customer's linked
   * companies (the account's identity, not a typed name), so it is linked at
   * once; the contact email is the account's email.
   */
  async createForCustomer(
    input: unknown,
    user: { email: string | null },
    allowedCompanyIds: string[] | undefined,
  ): Promise<QuoteRequestRecord> {
    if (!allowedCompanyIds) {
      throw new ForbiddenException(
        "Only a customer account can send its own quote request",
      );
    }
    if (!user.email) {
      throw new BadRequestException("The account has no email address");
    }
    const parsed = parseContract(portalQuoteRequestInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const companyId =
      parsed.data.companyId ??
      (allowedCompanyIds.length === 1 ? allowedCompanyIds[0] : null);
    if (!companyId) {
      throw new BadRequestException(
        "companyId is required: this account belongs to several companies",
      );
    }
    if (!allowedCompanyIds.includes(companyId)) {
      throw new NotFoundException("Customer company was not found");
    }
    const company = await this.database.findCustomer(companyId);
    if (!company) throw new NotFoundException("Customer company was not found");
    const created = await this.database.createQuoteRequest({
      id: randomUUID(),
      companyName: company.companyName,
      contactName: parsed.data.contactName,
      email: user.email,
      message: parsed.data.message,
      createdAt: new Date().toISOString(),
      customerCompanyId: null,
      customerCompanyName: null,
      quoteId: null,
      quoteNumber: null,
      quoteStatus: null,
    });
    const linked = await this.database.linkQuoteRequestToCustomer(
      created.id,
      company.id,
    );
    return linked ?? created;
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

  private validate(input: unknown): QuoteRequestInput {
    const result = parseContract(quoteRequestInputSchema, input);
    if (!result.success) throw new BadRequestException(result.message);
    return result.data;
  }
}
