import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { INestApplication } from "@nestjs/common";
import {
  createTestApplication,
  TEST_SUPER_ADMIN_ID,
  TEST_SUPER_ADMIN_TOKEN,
  TEST_UNASSIGNED_TOKEN,
} from "./test-application";

let temporaryDirectory: string;
let application: INestApplication;
let baseUrl: string;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalBootstrapEnabled = process.env.SUPER_ADMIN_BOOTSTRAP_ENABLED;

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "bjh-auth-bootstrap-"));
  process.env.DATABASE_PATH = join(temporaryDirectory, "auth.sqlite");
  delete process.env.DATABASE_URL;
  process.env.SUPER_ADMIN_BOOTSTRAP_ENABLED = "true";
  const started = await createTestApplication({ bootstrapSuperAdmin: false });
  application = started.application;
  baseUrl = started.baseUrl;
});

after(async () => {
  await application?.close();
  if (originalDatabasePath === undefined) {
    delete process.env.DATABASE_PATH;
  } else {
    process.env.DATABASE_PATH = originalDatabasePath;
  }
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
  if (originalBootstrapEnabled === undefined) {
    delete process.env.SUPER_ADMIN_BOOTSTRAP_ENABLED;
  } else {
    process.env.SUPER_ADMIN_BOOTSTRAP_ENABLED = originalBootstrapEnabled;
  }
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the first authenticated user can claim the only super-admin role", async () => {
  const bootstrapStatus = await fetch(
    `${baseUrl}/api/v1/auth/bootstrap-status`,
  );
  assert.deepEqual(await bootstrapStatus.json(), { bootstrapAvailable: true });

  const protectedWithoutToken = await fetch(`${baseUrl}/api/v1/customers`);
  assert.equal(protectedWithoutToken.status, 401);

  const invalidToken = await fetch(
    `${baseUrl}/api/v1/auth/bootstrap-super-admin`,
    {
      method: "POST",
      headers: { authorization: "Bearer invalid-test-token" },
    },
  );
  assert.equal(invalidToken.status, 401);

  const bootstrapResponse = await fetch(
    `${baseUrl}/api/v1/auth/bootstrap-super-admin`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SUPER_ADMIN_TOKEN}` },
    },
  );
  assert.equal(bootstrapResponse.status, 201);
  assert.deepEqual(await bootstrapResponse.json(), {
    userId: TEST_SUPER_ADMIN_ID,
    email: "admin@example.test",
    roles: ["super_admin"],
  });

  const sessionResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
    headers: { authorization: `Bearer ${TEST_SUPER_ADMIN_TOKEN}` },
  });
  assert.equal(sessionResponse.status, 200);
  assert.deepEqual(await sessionResponse.json(), {
    userId: TEST_SUPER_ADMIN_ID,
    email: "admin@example.test",
    roles: ["super_admin"],
  });

  const bootstrapClosed = await fetch(
    `${baseUrl}/api/v1/auth/bootstrap-status`,
  );
  assert.deepEqual(await bootstrapClosed.json(), { bootstrapAvailable: false });

  const secondBootstrap = await fetch(
    `${baseUrl}/api/v1/auth/bootstrap-super-admin`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${TEST_UNASSIGNED_TOKEN}` },
    },
  );
  assert.equal(secondBootstrap.status, 409);

  const unassignedAccess = await fetch(`${baseUrl}/api/v1/customers`, {
    headers: { authorization: `Bearer ${TEST_UNASSIGNED_TOKEN}` },
  });
  assert.equal(unassignedAccess.status, 403);

  const superAdminAccess = await fetch(`${baseUrl}/api/v1/customers`, {
    headers: { authorization: `Bearer ${TEST_SUPER_ADMIN_TOKEN}` },
  });
  assert.equal(superAdminAccess.status, 200);
});
