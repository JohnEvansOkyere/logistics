import { Module } from "@nestjs/common";
import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { ActivityController } from "./activity/activity.controller";
import { ActivityLogMiddleware } from "./activity/activity.middleware";
import { RequestErrorFilter } from "./request-error.filter";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { JobsController } from "./jobs/jobs.controller";
import { JobsService } from "./jobs/jobs.service";
import { CustomersController } from "./customers/customers.controller";
import { CustomersService } from "./customers/customers.service";
import { QuoteRequestsController } from "./quotations/quote-requests.controller";
import { QuoteRequestsService } from "./quotations/quote-requests.service";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 30 }]),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [
    HealthController,
    QuoteRequestsController,
    CustomersController,
    JobsController,
    ActivityController,
  ],
  providers: [
    QuoteRequestsService,
    CustomersService,
    JobsService,
    ActivityLogMiddleware,
    { provide: APP_FILTER, useClass: RequestErrorFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ActivityLogMiddleware).forRoutes("*");
  }
}
