import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SupabaseIdentityGuard, SuperAdminGuard } from "../auth/auth.guards";
import { QuoteRequestsService } from "./quote-requests.service";

@Controller("api/v1/quote-requests")
@UseGuards(SupabaseIdentityGuard, SuperAdminGuard)
export class QuoteRequestsController {
  constructor(
    @Inject(QuoteRequestsService)
    private readonly requests: QuoteRequestsService,
  ) {}

  @Post()
  create(@Body() body: unknown) {
    return this.requests.create(body);
  }

  @Get()
  list(@Query("customerCompanyId") customerCompanyId?: string) {
    return this.requests.list(customerCompanyId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.requests.get(id);
  }

  @Patch(":id/customer")
  associateCustomer(@Param("id") id: string, @Body() body: unknown) {
    return this.requests.associateCustomer(id, body);
  }
}
