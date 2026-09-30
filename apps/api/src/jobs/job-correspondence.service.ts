import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { correspondenceInputSchema, parseContract } from "@bjh/contracts";
import {
  DatabasePort,
  JobCorrespondenceRecord,
  JobScope,
} from "../database/database.port";
import { JobsService } from "./jobs.service";

/**
 * The manual correspondence log on a job. Staff record what was said in an
 * email, WhatsApp message, call or letter; nothing is sent from here. It is
 * internal, append-only and can be added to on closed jobs, since a client can
 * write after the file is closed.
 */
@Injectable()
export class JobCorrespondenceService {
  constructor(
    @Inject(DatabasePort) private readonly database: DatabasePort,
    @Inject(JobsService) private readonly jobs: JobsService,
  ) {}

  async list(id: string, scope: JobScope): Promise<JobCorrespondenceRecord[]> {
    const job = await this.jobs.get(id, scope);
    return this.database.listJobCorrespondence(job.id);
  }

  async add(
    id: string,
    input: unknown,
    recordedBy: string,
    scope: JobScope,
  ): Promise<JobCorrespondenceRecord> {
    const job = await this.jobs.get(id, scope);
    const parsed = parseContract(correspondenceInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const now = Date.now();
    const occurredAt = parsed.data.occurredAt ?? new Date(now).toISOString();
    if (Date.parse(occurredAt) > now + 5 * 60_000) {
      throw new BadRequestException("occurredAt cannot be in the future");
    }
    const result = await this.database.addJobCorrespondence({
      jobId: job.id,
      channel: parsed.data.channel,
      direction: parsed.data.direction,
      occurredAt,
      counterparty: parsed.data.counterparty,
      subject: parsed.data.subject,
      body: parsed.data.body,
      documentId: parsed.data.documentId,
      recordedBy,
    });
    if (result === "document_invalid") {
      throw new BadRequestException(
        "documentId must be a document on this job",
      );
    }
    return result;
  }
}
