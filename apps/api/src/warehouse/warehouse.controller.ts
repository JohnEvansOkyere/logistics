import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  DepartmentStaffGuard,
  JobScopeGuard,
  SupabaseIdentityGuard,
} from "../auth/auth.guards";
import type { AuthenticatedRequest } from "../auth/auth.guards";
import { WarehouseService } from "./warehouse.service";

function scopeOf(request: AuthenticatedRequest) {
  return {
    companyIds: request.allowedCompanyIds,
    serviceLines: request.allowedServiceLines,
  };
}

/** Warehouse locations: any staff member manages them. */
@Controller("api/v1/warehouse/locations")
@UseGuards(SupabaseIdentityGuard, DepartmentStaffGuard)
export class WarehouseLocationsController {
  constructor(
    @Inject(WarehouseService) private readonly warehouse: WarehouseService,
  ) {}

  @Get()
  list() {
    return this.warehouse.listLocations();
  }

  @Post()
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.warehouse.createLocation(body, request.authUser!.userId);
  }

  @Post(":id/active")
  setActive(@Param("id") id: string, @Body() body: unknown) {
    return this.warehouse.setLocationActive(id, body);
  }
}

/** Stock on one warehousing job: staff record it, customers read their own. */
@Controller("api/v1/jobs/:id/stock")
@UseGuards(SupabaseIdentityGuard)
export class JobStockController {
  constructor(
    @Inject(WarehouseService) private readonly warehouse: WarehouseService,
  ) {}

  @Get()
  @UseGuards(JobScopeGuard)
  list(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.warehouse.jobStock(id, scopeOf(request));
  }

  @Post()
  @UseGuards(DepartmentStaffGuard, JobScopeGuard)
  add(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.warehouse.addMovement(
      id,
      body,
      request.authUser!.userId,
      scopeOf(request),
    );
  }
}

/** The dated stock report across jobs, within the caller's scope. */
@Controller("api/v1/stock/report")
@UseGuards(SupabaseIdentityGuard)
export class StockReportController {
  constructor(
    @Inject(WarehouseService) private readonly warehouse: WarehouseService,
  ) {}

  @Get()
  @UseGuards(JobScopeGuard)
  report(
    @Query("asOf") asOf: string | undefined,
    @Query("companyId") companyId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.warehouse.report(asOf, companyId, scopeOf(request));
  }
}
