import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  DatabasePort,
  QuoteDraftRecord,
  QuoteRequestRecord,
} from "../database/database.port";

type QuoteRequestInput = Omit<
  QuoteRequestRecord,
  | "id"
  | "createdAt"
  | "customerCompanyId"
  | "customerCompanyName"
  | "quoteDraftRevisionCount"
  | "quoteDraftUpdatedAt"
>;

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

  list(customerCompanyId?: unknown): Promise<QuoteRequestRecord[]> {
    if (
      customerCompanyId !== undefined &&
      typeof customerCompanyId !== "string"
    ) {
      throw new BadRequestException("customerCompanyId must be a string");
    }

    return this.database.listQuoteRequests(customerCompanyId);
  }

  async get(id: string): Promise<QuoteRequestRecord> {
    const request = await this.database.findQuoteRequest(id);
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

  async getDraft(requestId: string): Promise<QuoteDraftRecord | null> {
    await this.requireAssociatedRequest(requestId);
    return this.database.findQuoteDraft(requestId);
  }

  async saveDraft(
    requestId: string,
    input: unknown,
  ): Promise<QuoteDraftRecord> {
    await this.requireAssociatedRequest(requestId);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("A quote draft object is required");
    }

    const content = (input as Record<string, unknown>).content;
    if (
      typeof content !== "string" ||
      !content.trim() ||
      content.length > 20000
    ) {
      throw new BadRequestException(
        "content must contain 1 to 20000 characters",
      );
    }

    return this.database.saveQuoteDraft(
      requestId,
      content.trim(),
      new Date().toISOString(),
    );
  }

  private async requireAssociatedRequest(
    requestId: string,
  ): Promise<QuoteRequestRecord> {
    const request = await this.get(requestId);
    if (!request.customerCompanyId) {
      throw new ConflictException(
        "Link the quote request to a customer company before drafting",
      );
    }
    return request;
  }

  private validate(input: unknown): QuoteRequestInput {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("A quote request object is required");
    }

    const values = input as Record<string, unknown>;
    const companyName = this.requiredText(
      values.companyName,
      "companyName",
      160,
    );
    const contactName = this.requiredText(
      values.contactName,
      "contactName",
      160,
    );
    const email = this.requiredText(values.email, "email", 254);
    const message = this.requiredText(values.message, "message", 5000);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("email must be a valid email address");
    }

    return { companyName, contactName, email, message };
  }

  private requiredText(
    value: unknown,
    field: string,
    maximumLength: number,
  ): string {
    if (typeof value !== "string") {
      throw new BadRequestException(`${field} is required`);
    }

    const text = value.trim();
    if (!text || text.length > maximumLength) {
      throw new BadRequestException(
        `${field} must contain 1 to ${maximumLength} characters`,
      );
    }

    return text;
  }
}
