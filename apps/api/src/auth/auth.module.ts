import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthController } from "./auth.controller";
import { AdminCompanyMembershipsController } from "./admin-company-memberships.controller";
import { AdminCompanyMembershipsService } from "./admin-company-memberships.service";
import { AdminStaffController } from "./admin-staff.controller";
import { AdminStaffService } from "./admin-staff.service";
import {
  CompanyScopeGuard,
  SupabaseIdentityGuard,
  StaffCompanyReadGuard,
  SuperAdminGuard,
} from "./auth.guards";
import { AuthService } from "./auth.service";
import { SupabaseAuthVerifier } from "./supabase-auth-verifier";
import {
  STAFF_AUTH_DIRECTORY,
  SupabaseStaffAuthDirectory,
} from "./staff-admin.port";

@Module({
  imports: [DatabaseModule],
  controllers: [
    AuthController,
    AdminStaffController,
    AdminCompanyMembershipsController,
  ],
  providers: [
    AuthService,
    SupabaseAuthVerifier,
    AdminStaffService,
    AdminCompanyMembershipsService,
    SupabaseStaffAuthDirectory,
    { provide: STAFF_AUTH_DIRECTORY, useExisting: SupabaseStaffAuthDirectory },
    SupabaseIdentityGuard,
    StaffCompanyReadGuard,
    SuperAdminGuard,
    CompanyScopeGuard,
  ],
  exports: [
    SupabaseAuthVerifier,
    SupabaseIdentityGuard,
    SuperAdminGuard,
    CompanyScopeGuard,
    StaffCompanyReadGuard,
  ],
})
export class AuthModule {}
