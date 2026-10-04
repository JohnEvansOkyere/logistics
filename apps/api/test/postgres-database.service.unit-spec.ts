import assert from "node:assert/strict";
import { ServiceUnavailableException } from "@nestjs/common";
import { test } from "node:test";
import { HealthController } from "../src/health.controller";
import { DatabasePort } from "../src/database/database.port";
import { PostgresDatabaseService } from "../src/database/postgres-database.service";
import type { PostgresPool } from "../src/database/postgres-database.service";

test("Postgres health uses a read-only query and reports the provider", async () => {
  const queries: string[] = [];
  const pool: PostgresPool = {
    async query(queryText) {
      queries.push(queryText);
      return { rows: [{ result: 1 }] };
    },
    async connect() {
      throw new Error("Connection transactions are not used in this test");
    },
    async end() {},
  };
  const database = new PostgresDatabaseService(pool);

  assert.deepEqual(await database.healthCheck(), {
    status: "ok",
    provider: "postgresql",
  });
  assert.deepEqual(queries, ["SELECT 1"]);
});

test("Postgres health reports an error without exposing connection details", async () => {
  const pool: PostgresPool = {
    async query() {
      throw new Error("password=synthetic-secret");
    },
    async connect() {
      throw new Error("Connection transactions are not used in this test");
    },
    async end() {},
  };
  const database = new PostgresDatabaseService(pool);

  assert.deepEqual(await database.healthCheck(), {
    status: "error",
    provider: "postgresql",
  });
});

test("Postgres staff-role assignment serializes super-admin creation and records actor", async () => {
  const statements: Array<{ query: string; values?: unknown[] }> = [];
  const client = {
    async query(query: string, values?: unknown[]) {
      statements.push({ query, values });
      if (query.includes("SELECT 1 FROM app.staff_role_assignment")) {
        return { rows: [] };
      }
      if (query.includes("RETURNING assignment_id")) {
        return {
          rows: [
            {
              assignment_id: "assignment-1",
              user_id: "user-1",
              role_key: "super_admin",
              assigned_by: "actor-1",
              assigned_at: new Date("2026-09-28T10:00:00.000Z"),
              revoked_at: null,
            },
          ],
        };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool: PostgresPool = {
    async query() {
      return { rows: [] };
    },
    async connect() {
      return client;
    },
    async end() {},
  };
  const database = new PostgresDatabaseService(pool);

  const assignment = await database.assignStaffRole(
    "user-1",
    "super_admin",
    "actor-1",
  );

  assert.equal(typeof assignment, "object");
  assert.equal(
    assignment &&
      assignment !== "super_admin_exists" &&
      assignment !== "already_active"
      ? assignment.assignedBy
      : "",
    "actor-1",
  );
  assert.ok(
    statements.some(({ query }) =>
      query.includes("pg_advisory_xact_lock(hashtext('bjh_super_admin_role')"),
    ),
  );
  assert.ok(statements.some(({ query }) => query === "COMMIT"));
});

test("Postgres staff-role revocation attributes the audit trigger to the actor", async () => {
  const statements: Array<{ query: string; values?: unknown[] }> = [];
  const client = {
    async query(query: string, values?: unknown[]) {
      statements.push({ query, values });
      if (query.includes("COUNT(*)")) return { rows: [{ count: "2" }] };
      if (query.includes("SELECT assignment_id")) {
        return { rows: [{ assignment_id: "assignment-1" }] };
      }
      if (query.startsWith("UPDATE app.staff_role_assignment")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool: PostgresPool = {
    async query() {
      return { rows: [] };
    },
    async connect() {
      return client;
    },
    async end() {},
  };
  const database = new PostgresDatabaseService(pool);

  assert.equal(
    await database.revokeStaffRole("user-1", "super_admin", "actor-1"),
    "revoked",
  );
  assert.ok(
    statements.some(
      ({ query, values }) =>
        query.includes("set_config('request.jwt.claim.sub'") &&
        values?.[0] === "actor-1",
    ),
  );
  assert.ok(statements.some(({ query }) => query === "COMMIT"));
});

test("Postgres customer and quote queries apply company membership scopes", async () => {
  const calls: Array<{ query: string; values?: unknown[] }> = [];
  const pool: PostgresPool = {
    async query(query, values) {
      calls.push({ query, values });
      return { rows: [] };
    },
    async connect() {
      throw new Error("Connection transactions are not used in this test");
    },
    async end() {},
  };
  const database = new PostgresDatabaseService(pool);
  const companyId = "50000000-0000-4000-8000-000000000010";

  assert.deepEqual(await database.listCustomers("", [companyId]), []);
  assert.deepEqual(
    await database.listQuoteRequests(undefined, [companyId]),
    [],
  );
  assert.ok(calls.every(({ query }) => query.includes("ANY($2::uuid[])")));
  assert.deepEqual(
    calls.map(({ values }) => values?.[1]),
    [[companyId], [companyId]],
  );
});

test("Postgres company-membership queries use active rows and revocation audit actor", async () => {
  const membershipId = "50000000-0000-4000-8000-000000000020";
  const companyId = "50000000-0000-4000-8000-000000000010";
  const userId = "50000000-0000-4000-8000-000000000003";
  const actorId = "50000000-0000-4000-8000-000000000001";
  const statements: Array<{ query: string; values?: unknown[] }> = [];
  const client = {
    async query(query: string, values?: unknown[]) {
      statements.push({ query, values });
      return {
        rows: [],
        rowCount: query.startsWith("UPDATE app.customer_membership") ? 1 : 0,
      };
    },
    release() {},
  };
  const pool: PostgresPool = {
    async query(query, values) {
      statements.push({ query, values });
      if (query.includes("INSERT INTO app.customer_membership")) {
        return {
          rows: [
            {
              membership_id: membershipId,
              company_id: companyId,
              user_id: userId,
              granted_by: actorId,
              granted_at: new Date("2026-09-28T10:00:00.000Z"),
              revoked_at: null,
            },
          ],
        };
      }
      if (query.includes("SELECT company_id FROM app.customer_membership")) {
        return { rows: [{ company_id: companyId }] };
      }
      return { rows: [] };
    },
    async connect() {
      return client;
    },
    async end() {},
  };
  const database = new PostgresDatabaseService(pool);

  assert.deepEqual(await database.getActiveCustomerCompanyIds(userId), [
    companyId,
  ]);
  const membership = await database.grantCustomerMembership(
    companyId,
    userId,
    actorId,
  );
  assert.equal(
    membership === "already_active" ? "" : membership.id,
    membershipId,
  );
  assert.equal(
    await database.revokeCustomerMembership(companyId, userId, actorId),
    true,
  );
  assert.ok(
    statements.some(
      ({ query, values }) =>
        query.includes("set_config('request.jwt.claim.sub'") &&
        values?.[0] === actorId,
    ),
  );
});

test("API health returns 503 without leaking database errors", async () => {
  const database = {
    async healthCheck() {
      return { status: "error" as const, provider: "postgresql" as const };
    },
  } as DatabasePort;
  const controller = new HealthController(database);

  await assert.rejects(controller.getHealth(), (error: unknown) => {
    assert.ok(error instanceof ServiceUnavailableException);
    assert.equal(error.getStatus(), 503);
    assert.doesNotMatch(
      JSON.stringify(error.getResponse()),
      /password|DATABASE_URL/i,
    );
    return true;
  });
});
