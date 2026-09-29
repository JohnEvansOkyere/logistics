import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isUuid,
  jobPartyInputSchema,
  parseContract,
  referenceKindAllowedFor,
  shipmentReferenceInputSchema,
} from "@bjh/contracts";
import {
  DatabasePort,
  JobPartyRecord,
  JobRecord,
  JobScope,
  ShipmentReferenceRecord,
} from "../database/database.port";
import { JobsService } from "./jobs.service";

/** Parties and shipment references (master/house documents, containers) on a job. */
@Injectable()
export class JobDetailsService {
  constructor(
    @Inject(DatabasePort) private readonly database: DatabasePort,
    @Inject(JobsService) private readonly jobs: JobsService,
  ) {}

  async listParties(id: string, scope: JobScope): Promise<JobPartyRecord[]> {
    const job = await this.jobs.get(id, scope);
    return this.database.listJobParties(job.id);
  }

  async addParty(
    id: string,
    input: unknown,
    createdBy: string,
    scope: JobScope,
  ): Promise<JobPartyRecord> {
    const job = await this.editableJob(id, scope);
    const parsed = parseContract(jobPartyInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    return this.database.addJobParty({
      jobId: job.id,
      ...parsed.data,
      createdBy,
    });
  }

  async removeParty(
    id: string,
    partyId: string,
    removedBy: string,
    scope: JobScope,
  ): Promise<{ removed: true }> {
    const job = await this.editableJob(id, scope);
    if (
      !isUuid(partyId) ||
      !(await this.database.removeJobParty(job.id, partyId, removedBy))
    ) {
      throw new NotFoundException("Party was not found on this job");
    }
    return { removed: true };
  }

  async listReferences(
    id: string,
    scope: JobScope,
  ): Promise<ShipmentReferenceRecord[]> {
    const job = await this.jobs.get(id, scope);
    return this.database.listShipmentReferences(job.id);
  }

  async addReference(
    id: string,
    input: unknown,
    createdBy: string,
    scope: JobScope,
  ): Promise<ShipmentReferenceRecord> {
    const job = await this.editableJob(id, scope);
    const parsed = parseContract(shipmentReferenceInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const { kind, value, sealNumber, parentReferenceId } = parsed.data;

    if (!referenceKindAllowedFor(job.serviceLine, kind)) {
      throw new BadRequestException(
        `${kind} cannot be recorded on a ${job.serviceLine} job`,
      );
    }
    if (sealNumber && kind !== "container") {
      throw new BadRequestException("Only containers carry a seal number");
    }
    const isHouse = kind === "house_bl" || kind === "house_awb";
    if (isHouse !== (parentReferenceId !== null)) {
      throw new BadRequestException(
        isHouse
          ? "A house document must reference its master"
          : "Only house documents can reference a master",
      );
    }

    const result = await this.database.addShipmentReference({
      jobId: job.id,
      kind,
      value,
      sealNumber,
      parentReferenceId,
      createdBy,
    });
    if (result === "duplicate_reference") {
      throw new ConflictException("This reference is already on the job");
    }
    if (result === "parent_invalid") {
      throw new BadRequestException(
        "parentReferenceId must be an active master of the matching kind on this job",
      );
    }
    return result;
  }

  async removeReference(
    id: string,
    referenceId: string,
    removedBy: string,
    scope: JobScope,
  ): Promise<{ removed: true }> {
    const job = await this.editableJob(id, scope);
    const removed = isUuid(referenceId)
      ? await this.database.removeShipmentReference(
          job.id,
          referenceId,
          removedBy,
        )
      : false;
    if (removed === "has_children") {
      throw new ConflictException(
        "Remove the house documents under this master first",
      );
    }
    if (!removed) {
      throw new NotFoundException("Reference was not found on this job");
    }
    return { removed: true };
  }

  private async editableJob(id: string, scope: JobScope): Promise<JobRecord> {
    const job = await this.jobs.get(id, scope);
    if (job.status === "closed" || job.status === "cancelled") {
      throw new ConflictException("Reopen the job before changing it");
    }
    return job;
  }
}
