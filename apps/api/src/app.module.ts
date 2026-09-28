import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { CustomersController } from "./customers/customers.controller";
import { CustomersService } from "./customers/customers.service";
import { QuoteRequestsController } from "./quotations/quote-requests.controller";
import { QuoteRequestsService } from "./quotations/quote-requests.service";

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, QuoteRequestsController, CustomersController],
  providers: [QuoteRequestsService, CustomersService],
})
export class AppModule {}
