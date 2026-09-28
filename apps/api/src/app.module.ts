import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { QuoteRequestsController } from "./quotations/quote-requests.controller";
import { QuoteRequestsService } from "./quotations/quote-requests.service";

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, QuoteRequestsController],
  providers: [QuoteRequestsService],
})
export class AppModule {}
