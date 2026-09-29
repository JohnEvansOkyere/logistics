import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
} from "@nestjs/common";
import { isUuid } from "@bjh/contracts";
import { SupabaseIdentityGuard, SuperAdminGuard } from "../auth/auth.guards";
import { DatabasePort } from "../database/database.port";

const PAGE_SIZE = 50;

function optionalUuid(name: string, value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!isUuid(value))
    throw new BadRequestException(`${name} must be a valid ID`);
  return value;
}

function optionalDate(name: string, value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`${name} must be a date and time`);
  }
  return new Date(value).toISOString();
}

@Controller("api/v1/admin/activity")
@UseGuards(SupabaseIdentityGuard, SuperAdminGuard)
export class ActivityController {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  /** Newest first; super admin only. */
  @Get()
  async list(
    @Query("actor") actor?: string,
    @Query("entity") entity?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") pageValue?: string,
  ) {
    const page = pageValue === undefined ? 1 : Number(pageValue);
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException("page must be a positive integer");
    }
    const entries = await this.database.listActivity({
      actorUserId: optionalUuid("actor", actor),
      entityId: optionalUuid("entity", entity),
      from: optionalDate("from", from),
      to: optionalDate("to", to),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    return { page, pageSize: PAGE_SIZE, entries };
  }
}
