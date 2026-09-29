import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { isUuid, jobCreateInputSchema, parseContract } from "@bjh/contracts";
import { serviceLinesForRoles } from "../auth/auth.guards";
import {
  DatabasePort,
  JobRecord,
  JobScope,
  StaffRoleKey,
} from "../database/database.port";

@Injectable()
export class JobsService {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  /** Any active staff role may open a job; reps only for their own service line. */
  async create(
    input: unknown,
    openedBy: string,
    roles: StaffRoleKey[],
  ): Promise<JobRecord> {
    const parsed = parseContract(jobCreateInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const { customerCompanyId, serviceLine, quoteRequestId } = parsed.data;

    if (
      !roles.includes("super_admin") &&
      !serviceLinesForRoles(roles).includes(serviceLine)
    ) {
      throw new ForbiddenException(
        "You can only open jobs for your own service line",
      );
    }
    if (!(await this.database.findCustomer(customerCompanyId))) {
      throw new NotFoundException("Customer company was not found");
    }
    if (quoteRequestId) {
      const quoteRequest = await this.database.findQuoteRequest(quoteRequestId);
      if (!quoteRequest) {
        throw new NotFoundException("Quote request was not found");
      }
      if (quoteRequest.customerCompanyId !== customerCompanyId) {
        throw new BadRequestException(
          "quoteRequestId must belong to the same customer company",
        );
      }
    }

    return this.database.createJob(
      { customerCompanyId, serviceLine, quoteRequestId },
      openedBy,
      new Date().getUTCFullYear(),
    );
  }

  list(search: unknown, scope: JobScope): Promise<JobRecord[]> {
    if (search !== undefined && typeof search !== "string") {
      throw new BadRequestException("search must be a string");
    }
    const term = (search ?? "").trim();
    if (term.length > 200) {
      throw new BadRequestException("search must be at most 200 characters");
    }
    return this.database.listJobs(term, scope);
  }

  async get(id: string, scope: JobScope): Promise<JobRecord> {
    const job = isUuid(id) ? await this.database.findJob(id, scope) : null;
    if (!job) throw new NotFoundException("Job was not found");
    return job;
  }
}
