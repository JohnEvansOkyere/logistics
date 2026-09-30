import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  activeInputSchema,
  isUuid,
  parseContract,
  stockMovementInputSchema,
  warehouseLocationInputSchema,
} from "@bjh/contracts";
import {
  DatabasePort,
  JobRecord,
  JobScope,
  StockBalanceRecord,
  StockMovementRecord,
  WarehouseLocationRecord,
} from "../database/database.port";
import { JobsService } from "../jobs/jobs.service";

/**
 * Light warehousing: named locations, and goods received and released on a
 * warehousing job. The balance is receipts minus releases and never goes
 * below zero at any date. Storage charges are invoiced with the normal
 * invoice lines; this is not a full inventory system.
 */
@Injectable()
export class WarehouseService {
  constructor(
    @Inject(DatabasePort) private readonly database: DatabasePort,
    @Inject(JobsService) private readonly jobs: JobsService,
  ) {}

  listLocations(): Promise<WarehouseLocationRecord[]> {
    return this.database.listWarehouseLocations();
  }

  async createLocation(
    input: unknown,
    createdBy: string,
  ): Promise<WarehouseLocationRecord> {
    const parsed = parseContract(warehouseLocationInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const result = await this.database.createWarehouseLocation(
      parsed.data.name,
      createdBy,
    );
    if (result === "duplicate_name") {
      throw new ConflictException("A location with this name exists");
    }
    return result;
  }

  async setLocationActive(
    id: string,
    input: unknown,
  ): Promise<WarehouseLocationRecord> {
    const parsed = parseContract(activeInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const location = isUuid(id)
      ? await this.database.setWarehouseLocationActive(id, parsed.data.active)
      : null;
    if (!location) throw new NotFoundException("Location was not found");
    return location;
  }

  async jobStock(
    id: string,
    scope: JobScope,
  ): Promise<{
    movements: StockMovementRecord[];
    balances: StockBalanceRecord[];
  }> {
    const job = await this.jobs.get(id, scope);
    const [movements, balances] = await Promise.all([
      this.database.listStockMovements(job.id),
      this.database.listStockBalances({
        asOf: null,
        jobId: job.id,
        companyId: null,
        scope,
      }),
    ]);
    return { movements, balances };
  }

  async addMovement(
    id: string,
    input: unknown,
    recordedBy: string,
    scope: JobScope,
  ): Promise<StockMovementRecord> {
    const job = await this.editableWarehouseJob(id, scope);
    const parsed = parseContract(stockMovementInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const now = Date.now();
    const occurredAt = parsed.data.occurredAt ?? new Date(now).toISOString();
    if (Date.parse(occurredAt) > now + 5 * 60_000) {
      throw new BadRequestException("occurredAt cannot be in the future");
    }
    const result = await this.database.addStockMovement({
      jobId: job.id,
      ...parsed.data,
      occurredAt,
      recordedBy,
    });
    if (result === "location_unavailable") {
      throw new BadRequestException("locationId must be a location in use");
    }
    if (result === "insufficient_stock") {
      throw new ConflictException(
        "Insufficient stock: the balance of this item at this location cannot go below zero",
      );
    }
    return result;
  }

  /** Stock held per customer, job, location and item, as of a date (default: now). */
  async report(
    asOf: unknown,
    companyId: unknown,
    scope: JobScope,
  ): Promise<{ asOf: string | null; balances: StockBalanceRecord[] }> {
    if (asOf !== undefined && !this.isDate(asOf)) {
      throw new BadRequestException("asOf must be a date (YYYY-MM-DD)");
    }
    if (companyId !== undefined && !isUuid(companyId)) {
      throw new BadRequestException("companyId must be a valid ID");
    }
    const balances = await this.database.listStockBalances({
      asOf: (asOf as string | undefined) ?? null,
      jobId: null,
      companyId: (companyId as string | undefined) ?? null,
      scope,
    });
    return { asOf: (asOf as string | undefined) ?? null, balances };
  }

  private isDate(value: unknown): value is string {
    return (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      new Date(value).toISOString().slice(0, 10) === value
    );
  }

  private async editableWarehouseJob(
    id: string,
    scope: JobScope,
  ): Promise<JobRecord> {
    const job = await this.jobs.get(id, scope);
    if (job.serviceLine !== "warehousing") {
      throw new ConflictException("Stock is recorded on a warehousing job");
    }
    if (job.status === "closed" || job.status === "cancelled") {
      throw new ConflictException("Reopen the job before changing it");
    }
    return job;
  }
}
