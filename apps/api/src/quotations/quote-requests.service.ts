import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabasePort, QuoteRequestRecord } from "../database/database.port";

type QuoteRequestInput = Omit<QuoteRequestRecord, "id" | "createdAt">;

@Injectable()
export class QuoteRequestsService {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async create(input: unknown): Promise<QuoteRequestRecord> {
    const details = this.validate(input);

    return this.database.createQuoteRequest({
      id: randomUUID(),
      ...details,
      createdAt: new Date().toISOString(),
    });
  }

  list(): Promise<QuoteRequestRecord[]> {
    return this.database.listQuoteRequests();
  }

  async get(id: string): Promise<QuoteRequestRecord> {
    const request = await this.database.findQuoteRequest(id);
    if (!request) {
      throw new NotFoundException("Quote request was not found");
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
