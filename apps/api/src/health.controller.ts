import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DatabasePort } from "./database/database.port";

@Controller("api/health")
export class HealthController {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  @Get()
  async getHealth() {
    const database = await this.database.healthCheck();
    if (database.status !== "ok") {
      throw new ServiceUnavailableException({
        status: "error",
        database,
      });
    }

    return {
      status: "ok",
      database,
    };
  }
}
