import { Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { SupabaseIdentityGuard } from "./auth.guards";
import type { AuthenticatedRequest } from "./auth.guards";
import { AuthService } from "./auth.service";

@Controller("api/v1/auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get("bootstrap-status")
  bootstrapStatus() {
    return this.auth.bootstrapStatus();
  }

  @Post("bootstrap-super-admin")
  @UseGuards(SupabaseIdentityGuard)
  bootstrapSuperAdmin(@Req() request: AuthenticatedRequest) {
    return this.auth.bootstrapSuperAdmin(request.authUser!);
  }

  @Get("session")
  @UseGuards(SupabaseIdentityGuard)
  getSession(@Req() request: AuthenticatedRequest) {
    return this.auth.getSession(request.authUser!);
  }
}
