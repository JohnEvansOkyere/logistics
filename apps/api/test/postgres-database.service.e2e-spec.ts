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
    async end() {},
  };
  const database = new PostgresDatabaseService(pool);

  assert.deepEqual(await database.healthCheck(), {
    status: "error",
    provider: "postgresql",
  });
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
