import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SupabaseIdentityGuard, SuperAdminGuard } from "../auth/auth.guards";
import { CustomersService } from "./customers.service";

@Controller("api/v1/customers")
@UseGuards(SupabaseIdentityGuard, SuperAdminGuard)
export class CustomersController {
  constructor(
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  @Post()
  create(@Body() body: unknown) {
    return this.customers.create(body);
  }

  @Get()
  list(@Query("search") search?: string) {
    return this.customers.list(search);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.customers.get(id);
  }
}
