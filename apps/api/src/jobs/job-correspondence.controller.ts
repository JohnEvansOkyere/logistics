import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  DepartmentStaffGuard,
  JobScopeGuard,
  SupabaseIdentityGuard,
} from "../auth/auth.guards";
import type { AuthenticatedRequest } from "../auth/auth.guards";
import { JobCorrespondenceService } from "./job-correspondence.service";

function scopeOf(request: AuthenticatedRequest) {
  return {
    companyIds: request.allowedCompanyIds,
    serviceLines: request.allowedServiceLines,
  };
}

/** Internal log of messages and calls: staff only, within their service lines. */
@Controller("api/v1/jobs/:id/correspondence")
@UseGuards(SupabaseIdentityGuard, DepartmentStaffGuard, JobScopeGuard)
export class JobCorrespondenceController {
  constructor(
    @Inject(JobCorrespondenceService)
    private readonly correspondence: JobCorrespondenceService,
  ) {}

  @Get()
  list(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.correspondence.list(id, scopeOf(request));
  }

  @Post()
  add(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.correspondence.add(
      id,
      body,
      request.authUser!.userId,
      scopeOf(request),
    );
  }
}
