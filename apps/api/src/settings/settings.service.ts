import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { businessSettingsSchema, parseContract } from "@bjh/contracts";
import {
  BusinessSettingsRevisionRecord,
  DatabasePort,
} from "../database/database.port";

/** Business settings; every save is a new revision, the newest is current. */
@Injectable()
export class SettingsService {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async get(): Promise<{ current: BusinessSettingsRevisionRecord | null }> {
    return { current: await this.database.getBusinessSettings() };
  }

  revisions(): Promise<BusinessSettingsRevisionRecord[]> {
    return this.database.listBusinessSettingsRevisions();
  }

  async save(
    input: unknown,
    changedBy: string,
  ): Promise<BusinessSettingsRevisionRecord> {
    const parsed = parseContract(businessSettingsSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    return this.database.saveBusinessSettings(parsed.data, changedBy);
  }
}
