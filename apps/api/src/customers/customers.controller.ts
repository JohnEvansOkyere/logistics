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

  @Patch(":id")
  @UseGuards(SuperAdminGuard)
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.customers.updateCustomer(id, body);
  }

  @Post(":id/contacts")
  @UseGuards(SuperAdminGuard)
  addContact(@Param("id") id: string, @Body() body: unknown) {
    return this.customers.addContact(id, body);
  }

  @Patch(":id/contacts/:contactId")
  @UseGuards(SuperAdminGuard)
  updateContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body() body: unknown,
  ) {
    return this.customers.updateContact(id, contactId, body);
  }

  @Get()
  @UseGuards(StaffCompanyReadGuard)
  list(
    @Query("search") search: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customers.list(search, request.allowedCompanyIds);
  }

  @Get(":id")
  @UseGuards(StaffCompanyReadGuard)
  get(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.customers.get(id, request.allowedCompanyIds);
  }
}
