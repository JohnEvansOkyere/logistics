import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  customerInputSchema,
  parseContract,
  type CustomerInput,
} from "@bjh/contracts";
import { randomUUID } from "node:crypto";
import { CustomerCompanyRecord, DatabasePort } from "../database/database.port";

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
    const result = parseContract(customerInputSchema, input);
    if (!result.success) throw new BadRequestException(result.message);
    return result.data;
  }
}
