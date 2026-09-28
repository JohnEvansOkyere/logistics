import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SupabaseIdentityGuard, SuperAdminGuard } from "./auth.guards";
import type { AuthenticatedRequest } from "./auth.guards";
import { AdminCompanyMembershipsService } from "./admin-company-memberships.service";

@Controller("api/v1/admin/company-memberships")
@UseGuards(SupabaseIdentityGuard, SuperAdminGuard)
export class AdminCompanyMembershipsController {
  constructor(
    @Inject(AdminCompanyMembershipsService)
    private readonly memberships: AdminCompanyMembershipsService,
  ) {}

  @Get()
  list(@Query("userId") userId?: string) {
    return this.memberships.list(userId);
  }

  @Post()
  grant(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.memberships.grant(body, request.authUser!);
  }

  @Delete(":userId/:companyId")
  revoke(
    @Param("userId") userId: string,
    @Param("companyId") companyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.memberships.revoke(userId, companyId, request.authUser!);
  }
}
