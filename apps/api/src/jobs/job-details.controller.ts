import {
  Body,
  Controller,
  Delete,
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
import { JobDetailsService } from "./job-details.service";

function scopeOf(request: AuthenticatedRequest) {
  return {
    companyIds: request.allowedCompanyIds,
    serviceLines: request.allowedServiceLines,
  };
}

@Controller("api/v1/jobs/:id")
@UseGuards(SupabaseIdentityGuard)
export class JobDetailsController {
  constructor(
    @Inject(JobDetailsService) private readonly details: JobDetailsService,
  ) {}

  @Get("parties")
  @UseGuards(JobScopeGuard)
  listParties(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.details.listParties(id, scopeOf(request));
  }

  @Post("parties")
  @UseGuards(DepartmentStaffGuard, JobScopeGuard)
  addParty(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.details.addParty(
      id,
      body,
      request.authUser!.userId,
      scopeOf(request),
    );
  }

  @Delete("parties/:partyId")
  @UseGuards(DepartmentStaffGuard, JobScopeGuard)
  removeParty(
    @Param("id") id: string,
    @Param("partyId") partyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.details.removeParty(
      id,
      partyId,
      request.authUser!.userId,
      scopeOf(request),
    );
  }

  @Get("references")
  @UseGuards(JobScopeGuard)
  listReferences(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.details.listReferences(id, scopeOf(request));
  }

  @Post("references")
  @UseGuards(DepartmentStaffGuard, JobScopeGuard)
  addReference(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.details.addReference(
      id,
      body,
      request.authUser!.userId,
      scopeOf(request),
    );
  }

  @Delete("references/:referenceId")
  @UseGuards(DepartmentStaffGuard, JobScopeGuard)
  removeReference(
    @Param("id") id: string,
    @Param("referenceId") referenceId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.details.removeReference(
      id,
      referenceId,
      request.authUser!.userId,
      scopeOf(request),
    );
  }
}
