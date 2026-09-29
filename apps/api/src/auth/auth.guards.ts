import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { DatabasePort } from "../database/database.port";
import type { ServiceLine, StaffRoleKey } from "../database/database.port";
import { SupabaseAuthVerifier } from "./supabase-auth-verifier";
import type { AuthenticatedUser } from "./supabase-auth-verifier";

export interface AuthenticatedRequest {
  headers: { authorization?: string | string[] };
  authUser?: AuthenticatedUser;
  allowedCompanyIds?: string[];
  allowedServiceLines?: ServiceLine[];
  staffRoles?: StaffRoleKey[];
  customerCompanyIds?: string[];
}

/** Reads the caller's active staff roles once per request. */
async function loadStaffRoles(
  database: DatabasePort,
  request: AuthenticatedRequest,
): Promise<StaffRoleKey[]> {
  request.staffRoles ??= await database.getActiveStaffRoles(
    request.authUser!.userId,
  );
  return request.staffRoles;
}

/** Reads the caller's active customer-company memberships once per request. */
async function loadCustomerCompanyIds(
  database: DatabasePort,
  request: AuthenticatedRequest,
): Promise<string[]> {
  request.customerCompanyIds ??= await database.getActiveCustomerCompanyIds(
    request.authUser!.userId,
  );
  return request.customerCompanyIds;
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

    const roles = await loadStaffRoles(this.database, request);
    if (!roles.includes("super_admin")) {
      throw new ForbiddenException("An active super_admin role is required");
    }

    return true;
  }
}

@Injectable()
export class CompanyScopeGuard implements CanActivate {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) throw new UnauthorizedException();

    const roles = await loadStaffRoles(this.database, request);
    if (roles.includes("super_admin")) {
      request.allowedCompanyIds = undefined;
      return true;
    }
    if (roles.length > 0) {
      throw new ForbiddenException(
        "Department staff access for this API is not configured",
      );
    }

    const companyIds = await loadCustomerCompanyIds(this.database, request);
    if (companyIds.length === 0) {
      throw new ForbiddenException(
        "An active staff role or customer-company membership is required",
      );
    }
    request.allowedCompanyIds = companyIds;
    return true;
  }
}

@Injectable()
export class StaffCompanyReadGuard implements CanActivate {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) throw new UnauthorizedException();

    const roles = await loadStaffRoles(this.database, request);
    if (roles.length > 0) {
      request.allowedCompanyIds = undefined;
      return true;
    }

    const companyIds = await loadCustomerCompanyIds(this.database, request);
    if (companyIds.length === 0) {
      throw new ForbiddenException(
        "An active staff role or customer-company membership is required",
      );
    }
    request.allowedCompanyIds = companyIds;
    return true;
  }
}

@Injectable()
export class QuoteDraftReadGuard implements CanActivate {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { params: { id: string } }>();
    if (!request.authUser) throw new UnauthorizedException();
    const roles = await loadStaffRoles(this.database, request);
    if (roles.includes("super_admin")) return true;
    if (roles.length > 0) {
      const assignedRole = await this.database.getQuoteRequestDepartment(
        request.params.id,
      );
      if (assignedRole === undefined)
        throw new NotFoundException("Quote request was not found");
      if (assignedRole !== null && roles.includes(assignedRole)) return true;
      throw new ForbiddenException(
        "This request is not assigned to your department",
      );
    }
    const companyIds = await loadCustomerCompanyIds(this.database, request);
    if (!companyIds.length)
      throw new ForbiddenException(
        "An active staff role or customer-company membership is required",
      );
    const quoteRequest = await this.database.findQuoteRequest(
      request.params.id,
      companyIds,
    );
    if (!quoteRequest)
      throw new NotFoundException("Quote request was not found");
    request.allowedCompanyIds = companyIds;
    return true;
  }
}

@Injectable()
export class QuoteDraftWriteGuard implements CanActivate {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { params: { id: string } }>();
    if (!request.authUser) throw new UnauthorizedException();
    const roles = await loadStaffRoles(this.database, request);
    if (roles.includes("super_admin")) return true;
    const assignedRole = await this.database.getQuoteRequestDepartment(
      request.params.id,
    );
    if (assignedRole === undefined)
      throw new NotFoundException("Quote request was not found");
    if (assignedRole !== null && roles.includes(assignedRole)) return true;
    throw new ForbiddenException(
      "Only the assigned department or super admin can save this draft",
    );
  }
}

@Injectable()
export class DepartmentStaffGuard implements CanActivate {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) throw new UnauthorizedException();
    const roles = await loadStaffRoles(this.database, request);
    if (!roles.length)
      throw new ForbiddenException("An active staff role is required");
    return true;
  }
}

/** Service lines a department role works on; `super_admin` maps to none. */
export function serviceLinesForRoles(roles: StaffRoleKey[]): ServiceLine[] {
  return roles
    .filter((role) => role !== "super_admin")
    .map((role) => role.replace(/_rep$/, "") as ServiceLine);
}

/** Super admins see every job, reps their own service lines, customers their companies. */
@Injectable()
export class JobScopeGuard implements CanActivate {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) throw new UnauthorizedException();
    const roles = await loadStaffRoles(this.database, request);
    if (roles.includes("super_admin")) return true;
    if (roles.length > 0) {
      request.allowedServiceLines = serviceLinesForRoles(roles);
      return true;
    }
    const companyIds = await loadCustomerCompanyIds(this.database, request);
    if (companyIds.length === 0) {
      throw new ForbiddenException(
        "An active staff role or customer-company membership is required",
      );
    }
    request.allowedCompanyIds = companyIds;
    return true;
  }
}
