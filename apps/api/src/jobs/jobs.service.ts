import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isUuid,
  jobCreateInputSchema,
  jobStatusChangeInputSchema,
  jobStatusReasonRequired,
  jobStatusTransitions,
  milestoneEventInputSchema,
  milestoneTemplates,
  parseContract,
} from "@bjh/contracts";
import { serviceLinesForRoles } from "../auth/auth.guards";
import {
  DatabasePort,
  JobRecord,
  JobScope,
  MilestoneEventRecord,
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

  /** The agreed milestone list for the job's service line, with recorded events. */
  async getTimeline(id: string, scope: JobScope) {
    const job = await this.get(id, scope);
    return {
      job,
      template: milestoneTemplates[job.serviceLine],
      events: await this.database.listMilestoneEvents(job.id),
    };
  }

  /** Append-only: corrections are new events pointing at the original. */
  async recordMilestone(
    id: string,
    input: unknown,
    recordedBy: string,
    scope: JobScope,
  ): Promise<MilestoneEventRecord> {
    const job = await this.get(id, scope);
    const parsed = parseContract(milestoneEventInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const { milestoneKey, note, correctionOf } = parsed.data;

    const template = milestoneTemplates[job.serviceLine];
    if (template.length === 0) {
      throw new ConflictException(
        "No milestone template has been agreed for this service line yet",
      );
    }
    if (!template.some((milestone) => milestone.key === milestoneKey)) {
      throw new BadRequestException(
        "milestoneKey is not part of this service line's milestones",
      );
    }
    if (job.status === "closed" || job.status === "cancelled") {
      throw new ConflictException("Reopen the job before recording milestones");
    }
    const now = Date.now();
    const occurredAt = parsed.data.occurredAt ?? new Date(now).toISOString();
    if (Date.parse(occurredAt) > now + 5 * 60_000) {
      throw new BadRequestException("occurredAt cannot be in the future");
    }

    const event = await this.database.appendMilestoneEvent({
      jobId: job.id,
      milestoneKey,
      occurredAt,
      recordedBy,
      note,
      correctionOf,
    });
    if (event === "correction_target_not_found") {
      throw new NotFoundException(
        "The event being corrected was not found on this job",
      );
    }
    return event;
  }

  async getStatusHistory(id: string, scope: JobScope) {
    const job = await this.get(id, scope);
    return {
      job,
      allowedNext: jobStatusTransitions[job.status],
      history: await this.database.listJobStatusHistory(job.id),
    };
  }

  /**
   * Moves a job along the status workflow. Anyone with access to the job's
   * department may do it, including reopening and closure overrides, and
   * those actions need a written reason. Every change is kept in history.
   */
  async changeStatus(
    id: string,
    input: unknown,
    changedBy: string,
    scope: JobScope,
  ): Promise<JobRecord> {
    const job = await this.get(id, scope);
    const parsed = parseContract(jobStatusChangeInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const { status, reason } = parsed.data;

    if (!jobStatusTransitions[job.status].includes(status)) {
      throw new ConflictException(
        `A job that is ${job.status} cannot move to ${status}`,
      );
    }
    if (jobStatusReasonRequired(job.status, status) && !reason) {
      throw new BadRequestException(
        "reason is required to cancel, reopen or override closure",
      );
    }
    const result = await this.database.changeJobStatus({
      jobId: job.id,
      from: job.status,
      to: status,
      reason,
      changedBy,
    });
    if (result === "status_changed") {
      throw new ConflictException(
        "The job status changed while you were editing; reload and try again",
      );
    }
    return result;
  }
}
