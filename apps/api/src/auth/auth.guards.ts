import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { DatabasePort } from "../database/database.port";
import { SupabaseAuthVerifier } from "./supabase-auth-verifier";
import type { AuthenticatedUser } from "./supabase-auth-verifier";

export interface AuthenticatedRequest {
  headers: { authorization?: string | string[] };
  authUser?: AuthenticatedUser;
}

@Injectable()
export class SupabaseIdentityGuard implements CanActivate {
  constructor(
    @Inject(SupabaseAuthVerifier)
    private readonly verifier: SupabaseAuthVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === "string"
        ? /^Bearer\s+(.+)$/i.exec(authorization)
        : null;

    if (!match?.[1]) {
      throw new UnauthorizedException("A Supabase bearer token is required");
    }

    request.authUser = await this.verifier.verify(match[1]);
    return true;
  }
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    const roles = await this.database.getActiveStaffRoles(
      request.authUser.userId,
    );
    if (!roles.includes("super_admin")) {
      throw new ForbiddenException("An active super_admin role is required");
    }

    return true;
  }
}
