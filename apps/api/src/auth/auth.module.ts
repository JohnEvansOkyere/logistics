import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthController } from "./auth.controller";
import { SupabaseIdentityGuard, SuperAdminGuard } from "./auth.guards";
import { AuthService } from "./auth.service";
import { SupabaseAuthVerifier } from "./supabase-auth-verifier";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseAuthVerifier,
    SupabaseIdentityGuard,
    SuperAdminGuard,
  ],
  exports: [SupabaseAuthVerifier, SupabaseIdentityGuard, SuperAdminGuard],
})
export class AuthModule {}
