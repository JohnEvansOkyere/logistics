import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CustomerCompanyRecord, DatabasePort } from "../database/database.port";

type CustomerInput = {
  companyName: string;
  contactName: string;
  email: string;
};

@Injectable()
export class CustomersService {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async create(input: unknown): Promise<CustomerCompanyRecord> {
    const details = this.validate(input);
    const createdAt = new Date().toISOString();

    return this.database.createCustomer({
      id: randomUUID(),
      companyName: details.companyName,
      createdAt,
      contacts: [
        {
          id: randomUUID(),
          name: details.contactName,
          email: details.email,
          createdAt,
        },
      ],
    });
  }

  list(
    search: unknown,
    companyIds?: string[],
  ): Promise<CustomerCompanyRecord[]> {
    if (search !== undefined && typeof search !== "string") {
      throw new BadRequestException("search must be a string");
    }

    const normalizedSearch = (search ?? "").trim();
    if (normalizedSearch.length > 200) {
      throw new BadRequestException("search must be at most 200 characters");
    }

    return this.database.listCustomers(normalizedSearch, companyIds);
  }

  async get(id: string, companyIds?: string[]): Promise<CustomerCompanyRecord> {
    const customer = await this.database.findCustomer(id, companyIds);
    if (!customer) {
      throw new NotFoundException("Customer was not found");
    }
    return customer;
  }

  private validate(input: unknown): CustomerInput {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("A customer object is required");
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("email must be a valid email address");
    }

    return { companyName, contactName, email };
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
