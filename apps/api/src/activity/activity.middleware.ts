import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NestMiddleware } from "@nestjs/common";
import { isUuid } from "@bjh/contracts";
import type { AuthenticatedRequest } from "../auth/auth.guards";
import { DatabasePort } from "../database/database.port";

interface TrackedRequest extends AuthenticatedRequest {
  method: string;
  ip?: string;
  params?: Record<string, string>;
  route?: { path?: string };
}

interface TrackedResponse {
  statusCode: number;
  on(event: "finish", listener: () => void): unknown;
}

/**
 * Records every request made by an authenticated user (allowed or denied) once
 * the response is sent. Bodies and query strings are deliberately not stored.
 */
@Injectable()
export class ActivityLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger("ActivityLog");

  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  use(
    request: TrackedRequest,
    response: TrackedResponse,
    next: () => void,
  ): void {
    response.on("finish", () => {
      const user = request.authUser;
      if (!user || !isUuid(user.userId)) return;
      const entityId = Object.values(request.params ?? {}).find(isUuid) ?? null;
      void this.database
        .recordActivity({
          actorUserId: user.userId,
          actorEmail: user.email ?? null,
          method: request.method,
          route: request.route?.path ?? "(unmatched)",
          entityId,
          statusCode: response.statusCode,
          clientIp: request.ip ?? null,
        })
        .catch(() => this.logger.error("Activity entry could not be stored"));
    });
    next();
  }
}
