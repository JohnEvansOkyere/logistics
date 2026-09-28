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
import { SupabaseIdentityGuard, SuperAdminGuard } from "../auth/auth.guards";
import type { AuthenticatedRequest } from "../auth/auth.guards";
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

  @Get(":id/draft")
  async getDraft(@Param("id") id: string) {
    return { draft: await this.requests.getDraft(id) };
  }

  @Put(":id/draft")
  saveDraft(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requests.saveDraft(id, body, request.authUser!.userId);
  }

  @Patch(":id/customer")
  associateCustomer(@Param("id") id: string, @Body() body: unknown) {
    return this.requests.associateCustomer(id, body);
  }
}
