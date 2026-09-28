import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabasePort } from "../database/database.port";
import type { AuthenticatedUser } from "./supabase-auth-verifier";
import { STAFF_AUTH_DIRECTORY } from "./staff-admin.port";
import type { StaffAuthDirectory } from "./staff-admin.port";

@Injectable()
export class AdminCompanyMembershipsService {
  constructor(
    @Inject(DatabasePort) private readonly database: DatabasePort,
    @Inject(STAFF_AUTH_DIRECTORY) private readonly auth: StaffAuthDirectory,
  ) {}

  async list(userId: string | undefined) {
    if (!userId?.trim()) {
      throw new BadRequestException("userId is required");
    }
    await this.requireActiveUser(userId);
    return this.database.listCustomerMemberships(userId);
  }

  async grant(input: unknown, actor: AuthenticatedUser) {
    const values =
      input && typeof input === "object" && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    const userId =
      typeof values.userId === "string" ? values.userId.trim() : "";
    const companyId =
      typeof values.companyId === "string" ? values.companyId.trim() : "";
    if (!userId || !companyId) {
      throw new BadRequestException("userId and companyId are required");
    }
    await this.requireActiveUser(userId);
    if (!(await this.database.findCustomer(companyId))) {
      throw new NotFoundException("Customer company was not found");
    }
    const membership = await this.database.grantCustomerMembership(
      companyId,
      userId,
      actor.userId,
    );
    if (membership === "already_active") {
      throw new ConflictException(
        "The customer-company membership is already active",
      );
    }
    return membership;
  }

  async revoke(userId: string, companyId: string, actor: AuthenticatedUser) {
    await this.requireActiveUser(userId);
    const revoked = await this.database.revokeCustomerMembership(
      companyId,
      userId,
      actor.userId,
    );
    if (!revoked) {
      throw new NotFoundException(
        "The active customer-company membership was not found",
      );
    }
    return { userId, companyId, revoked: true };
  }

  private async requireActiveUser(userId: string) {
    const user = await this.auth.getUser(userId);
    if (!user) throw new NotFoundException("User account was not found");
    if (user.suspended) {
      throw new ConflictException(
        "Reactivate the user account before assigning access",
      );
    }
  }
}
