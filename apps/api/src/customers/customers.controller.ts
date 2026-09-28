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
  CompanyScopeGuard,
  SupabaseIdentityGuard,
  SuperAdminGuard,
} from "../auth/auth.guards";
import type { AuthenticatedRequest } from "../auth/auth.guards";
import { CustomersService } from "./customers.service";

@Controller("api/v1/customers")
@UseGuards(SupabaseIdentityGuard)
export class CustomersController {
  constructor(
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  @Post()
  @UseGuards(SuperAdminGuard)
  create(@Body() body: unknown) {
    return this.customers.create(body);
  }

  @Get()
  @UseGuards(CompanyScopeGuard)
  list(
    @Query("search") search: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customers.list(search, request.allowedCompanyIds);
  }

  @Get(":id")
  @UseGuards(CompanyScopeGuard)
  get(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.customers.get(id, request.allowedCompanyIds);
  }
}
