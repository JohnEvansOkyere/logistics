import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthController } from "./auth.controller";
import { AdminStaffController } from "./admin-staff.controller";
import { AdminStaffService } from "./admin-staff.service";
import { SupabaseIdentityGuard, SuperAdminGuard } from "./auth.guards";
import { AuthService } from "./auth.service";
import { SupabaseAuthVerifier } from "./supabase-auth-verifier";
import {
  STAFF_AUTH_DIRECTORY,
  SupabaseStaffAuthDirectory,
} from "./staff-admin.port";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, AdminStaffController],
  providers: [
    AuthService,
    SupabaseAuthVerifier,
    AdminStaffService,
    SupabaseStaffAuthDirectory,
    { provide: STAFF_AUTH_DIRECTORY, useExisting: SupabaseStaffAuthDirectory },
    SupabaseIdentityGuard,
    SuperAdminGuard,
  ],
  exports: [SupabaseAuthVerifier, SupabaseIdentityGuard, SuperAdminGuard],
})
export class AuthModule {}
