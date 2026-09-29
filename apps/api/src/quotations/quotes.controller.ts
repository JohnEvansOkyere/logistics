import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  DepartmentStaffGuard,
  JobScopeGuard,
  SupabaseIdentityGuard,
} from "../auth/auth.guards";
import type { AuthenticatedRequest } from "../auth/auth.guards";
import { QuotesService } from "./quotes.service";

function scopeOf(request: AuthenticatedRequest) {
  return {
    companyIds: request.allowedCompanyIds,
    serviceLines: request.allowedServiceLines,
  };
}

@Controller("api/v1/quotes")
@UseGuards(SupabaseIdentityGuard)
export class QuotesController {
  constructor(@Inject(QuotesService) private readonly quotes: QuotesService) {}

  @Post()
  @UseGuards(DepartmentStaffGuard)
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.quotes.create(
      body,
      request.authUser!.userId,
      request.staffRoles!,
    );
  }

  @Get()
  @UseGuards(JobScopeGuard)
  list(@Req() request: AuthenticatedRequest) {
    return this.quotes.list(scopeOf(request));
  }

  @Get(":id")
  @UseGuards(JobScopeGuard)
  get(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.quotes.get(id, scopeOf(request));
  }

  @Put(":id/draft")
  @UseGuards(DepartmentStaffGuard, JobScopeGuard)
  saveDraft(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotes.saveDraft(id, body, scopeOf(request));
  }

  @Post(":id/versions")
  @UseGuards(DepartmentStaffGuard, JobScopeGuard)
  startVersion(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.quotes.startVersion(
      id,
      request.authUser!.userId,
      scopeOf(request),
    );
  }

  @Post(":id/issue")
  @UseGuards(DepartmentStaffGuard, JobScopeGuard)
  issue(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.quotes.issue(id, request.authUser!.userId, scopeOf(request));
  }

  @Post(":id/decision")
  @UseGuards(DepartmentStaffGuard, JobScopeGuard)
  decide(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotes.decide(
      id,
      body,
      request.authUser!.userId,
      scopeOf(request),
    );
  }
}
