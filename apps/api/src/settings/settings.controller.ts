import {
  Body,
  Controller,
  Get,
  Inject,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  DepartmentStaffGuard,
  SuperAdminGuard,
  SupabaseIdentityGuard,
} from "../auth/auth.guards";
import type { AuthenticatedRequest } from "../auth/auth.guards";
import { SettingsService } from "./settings.service";

@Controller("api/v1/settings")
@UseGuards(SupabaseIdentityGuard)
export class SettingsController {
  constructor(
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  /** Every staff member reads the current settings (currencies, defaults). */
  @Get()
  @UseGuards(DepartmentStaffGuard)
  get() {
    return this.settings.get();
  }

  @Get("revisions")
  @UseGuards(SuperAdminGuard)
  revisions() {
    return this.settings.revisions();
  }

  @Put()
  @UseGuards(SuperAdminGuard)
  save(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.settings.save(body, request.authUser!.userId);
  }
}
