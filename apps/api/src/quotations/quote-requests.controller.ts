import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
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

  @Patch(":id/customer")
  @UseGuards(SuperAdminGuard)
  associateCustomer(@Param("id") id: string, @Body() body: unknown) {
    return this.requests.associateCustomer(id, body);
  }
}
