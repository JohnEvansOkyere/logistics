import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { QuoteRequestsService } from "./quote-requests.service";

@Controller("api/v1/quote-requests")
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
  list() {
    return this.requests.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.requests.get(id);
  }
}
