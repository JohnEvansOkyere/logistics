import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  QuoteDraftReadGuard,
  QuoteDraftWriteGuard,
  DepartmentStaffGuard,
  SupabaseIdentityGuard,
  StaffCompanyReadGuard,
  SuperAdminGuard,
} from "../auth/auth.guards";
import type { AuthenticatedRequest } from "../auth/auth.guards";
import { QuoteRequestsService } from "./quote-requests.service";

@Controller("api/v1/quote-requests")
@UseGuards(SupabaseIdentityGuard)
export class QuoteRequestsController {
  constructor(
    @Inject(QuoteRequestsService)
    private readonly requests: QuoteRequestsService,
  ) {}

  @Post()
  @UseGuards(SuperAdminGuard)
  create(@Body() body: unknown) {
    return this.requests.create(body);
  }

  @Post("mine")
  @UseGuards(StaffCompanyReadGuard)
  createMine(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.requests.createForCustomer(
      body,
      request.authUser!,
      request.allowedCompanyIds,
    );
  }

  @Get()
  @UseGuards(StaffCompanyReadGuard)
  list(
    @Query("customerCompanyId") customerCompanyId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requests.list(customerCompanyId, request.allowedCompanyIds);
  }

  @Get(":id")
  @UseGuards(StaffCompanyReadGuard)
  get(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.requests.get(id, request.allowedCompanyIds);
  }

  @Get(":id/draft")
  @UseGuards(QuoteDraftReadGuard)
  async getDraft(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      draft: await this.requests.getDraft(id, request.allowedCompanyIds),
    };
  }

  @Put(":id/draft")
  @UseGuards(QuoteDraftWriteGuard)
  saveDraft(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requests.saveDraft(id, body, request.authUser!.userId);
  }

  @Patch(":id/customer")
  @UseGuards(SuperAdminGuard)
  associateCustomer(@Param("id") id: string, @Body() body: unknown) {
    return this.requests.associateCustomer(id, body);
  }

  @Get(":id/assignment")
  @UseGuards(DepartmentStaffGuard)
  async getAssignment(@Param("id") id: string) {
    return { roleKey: await this.requests.getDepartmentAssignment(id) };
  }

  @Patch(":id/assignment")
  @UseGuards(SuperAdminGuard)
  assignDepartment(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requests.assignDepartment(id, body, request.authUser!.userId);
  }
}
