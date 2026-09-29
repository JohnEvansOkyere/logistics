import "reflect-metadata";
import assert from "node:assert/strict";
import type { ExecutionContext } from "@nestjs/common";
import { test } from "node:test";
import {
  CompanyScopeGuard,
  DepartmentStaffGuard,
  StaffCompanyReadGuard,
  SuperAdminGuard,
} from "../src/auth/auth.guards";
import type { AuthenticatedRequest } from "../src/auth/auth.guards";
import type { DatabasePort } from "../src/database/database.port";

function countingDatabase(roles: string[], companyIds: string[]) {
  const calls = { roles: 0, companies: 0 };
  const database = {
    async getActiveStaffRoles() {
      calls.roles += 1;
      return roles;
    },
    async getActiveCustomerCompanyIds() {
      calls.companies += 1;
      return companyIds;
    },
  } as unknown as DatabasePort;
  return { database, calls };
}

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

test("stacked guards look up staff roles once per request", async () => {
  const { database, calls } = countingDatabase(["super_admin"], []);
  const request: AuthenticatedRequest = {
    headers: {},
    authUser: { userId: "u1", email: "a@example.test" },
  };
  const context = contextFor(request);

  await new SuperAdminGuard(database).canActivate(context);
  await new DepartmentStaffGuard(database).canActivate(context);
  await new CompanyScopeGuard(database).canActivate(context);

  assert.equal(calls.roles, 1);
});

test("stacked guards look up company memberships once per request", async () => {
  const { database, calls } = countingDatabase([], ["c1"]);
  const request: AuthenticatedRequest = {
    headers: {},
    authUser: { userId: "u2", email: "b@example.test" },
  };
  const context = contextFor(request);

  await new CompanyScopeGuard(database).canActivate(context);
  await new StaffCompanyReadGuard(database).canActivate(context);

  assert.equal(calls.roles, 1);
  assert.equal(calls.companies, 1);
  assert.deepEqual(request.allowedCompanyIds, ["c1"]);
});

test("cached roles are per request and never shared between callers", async () => {
  const { database, calls } = countingDatabase([], ["c1"]);
  const guard = new StaffCompanyReadGuard(database);
  for (const userId of ["u3", "u4"]) {
    await guard.canActivate(
      contextFor({
        headers: {},
        authUser: { userId, email: `${userId}@example.test` },
      }),
    );
  }
  assert.equal(calls.roles, 2);
});
