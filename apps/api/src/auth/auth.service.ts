import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { DatabasePort } from "../database/database.port";
import type { AuthenticatedUser } from "./supabase-auth-verifier";

@Injectable()
export class AuthService {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async bootstrapStatus(): Promise<{ bootstrapAvailable: boolean }> {
    return {
      bootstrapAvailable:
        this.bootstrapEnabled() && !(await this.database.hasActiveSuperAdmin()),
    };
  }

  async bootstrapSuperAdmin(user: AuthenticatedUser) {
    if (!this.bootstrapEnabled()) {
      throw new ForbiddenException("Super-admin bootstrap is disabled");
    }

    const assigned = await this.database.claimInitialSuperAdmin(user.userId);
    if (!assigned) {
      throw new ConflictException(
        "The initial super_admin account is already set up",
      );
    }

    return {
      userId: user.userId,
      email: user.email,
      roles: ["super_admin"],
    };
  }

  async getSession(user: AuthenticatedUser) {
    const roles = await this.database.getActiveStaffRoles(user.userId);
    return {
      userId: user.userId,
      email: user.email,
      roles,
    };
  }

  private bootstrapEnabled(): boolean {
    return (
      process.env.NODE_ENV !== "production" &&
      process.env.SUPER_ADMIN_BOOTSTRAP_ENABLED === "true"
    );
  }
}
