import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { after, before, test } from "node:test";
import {
  TEST_CUSTOMER_A_ID,
  TEST_CUSTOMER_A_TOKEN,
  TEST_MATCHING_TOKEN,
  TEST_MATCHING_USER_ID,
  TEST_SUPER_ADMIN_ID,
  TEST_SUPER_ADMIN_TOKEN,
  TEST_UNASSIGNED_TOKEN,
  TEST_UNASSIGNED_USER_ID,
  createTestApplication,
} from "./test-application";
import { DatabasePort } from "../src/database/database.port";
import { beginTestDatabase, endTestDatabase } from "./postgres-test-database";

let application: INestApplication;
let baseUrl: string;
let companyId: string;

function call(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function openJob(): Promise<string> {
  const response = await call("/api/v1/jobs", TEST_SUPER_ADMIN_TOKEN, {
    method: "POST",
    body: JSON.stringify({
      customerCompanyId: companyId,
      serviceLine: "sea_import",
    }),
  });
  return ((await response.json()) as { id: string }).id;
}

function setStatus(jobId: string, token: string, body: unknown) {
  return call(`/api/v1/jobs/${jobId}/status`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

before(async () => {
  await beginTestDatabase();
  const started = await createTestApplication();
  application = started.application;
  baseUrl = started.baseUrl;
  const database = application.get(DatabasePort);
  await database.assignStaffRole(
    TEST_MATCHING_USER_ID,
    "sea_import_rep",
    TEST_SUPER_ADMIN_ID,
  );
  await database.assignStaffRole(
    TEST_UNASSIGNED_USER_ID,
    "air_export_rep",
    TEST_SUPER_ADMIN_ID,
  );
  companyId = randomUUID();
  await database.createCustomer({
    id: companyId,
    companyName: "Northstar Synthetic Ltd",
    createdAt: new Date().toISOString(),
    contacts: [],
  });
  await database.grantCustomerMembership(
    companyId,
    TEST_CUSTOMER_A_ID,
    TEST_SUPER_ADMIN_ID,
  );
});

after(async () => {
  await application?.close();
  await endTestDatabase();
});

test("the department rep moves a job through the normal workflow", async () => {
  const jobId = await openJob();
  for (const status of [
    "in_progress",
    "on_hold",
    "in_progress",
    "ready_to_close",
    "closed",
  ]) {
    const response = await setStatus(jobId, TEST_MATCHING_TOKEN, { status });
    assert.equal(response.status, 201, status);
    assert.equal(
      ((await response.json()) as { status: string }).status,
      status,
    );
  }
  const closed = (await (
    await call(`/api/v1/jobs/${jobId}`, TEST_MATCHING_TOKEN)
  ).json()) as { closedAt: string | null };
  assert.ok(closed.closedAt);

  const history = (await (
    await call(`/api/v1/jobs/${jobId}/status-history`, TEST_MATCHING_TOKEN)
  ).json()) as {
    allowedNext: string[];
    history: Array<{ fromStatus: string; toStatus: string; changedBy: string }>;
  };
  assert.deepEqual(
    history.history.map((entry) => `${entry.fromStatus}>${entry.toStatus}`),
    [
      "open>in_progress",
      "in_progress>on_hold",
      "on_hold>in_progress",
      "in_progress>ready_to_close",
      "ready_to_close>closed",
    ],
  );
  assert.ok(
    history.history.every((entry) => entry.changedBy === TEST_MATCHING_USER_ID),
  );
  assert.deepEqual(history.allowedNext, ["in_progress"]);
});

test("invalid transitions and missing reasons are rejected", async () => {
  const jobId = await openJob();
  const invalid = await setStatus(jobId, TEST_MATCHING_TOKEN, {
    status: "ready_to_close",
  });
  assert.equal(invalid.status, 409);
  const same = await setStatus(jobId, TEST_MATCHING_TOKEN, { status: "open" });
  assert.equal(same.status, 409);
  const unknown = await setStatus(jobId, TEST_MATCHING_TOKEN, {
    status: "finished",
  });
  assert.equal(unknown.status, 400);
  const cancelNoReason = await setStatus(jobId, TEST_MATCHING_TOKEN, {
    status: "cancelled",
  });
  assert.equal(cancelNoReason.status, 400);
  const overrideNoReason = await setStatus(jobId, TEST_MATCHING_TOKEN, {
    status: "closed",
  });
  assert.equal(overrideNoReason.status, 400);
  assert.equal((await setStatus(jobId, TEST_MATCHING_TOKEN, [])).status, 400);
});

test("the department in charge can override closure and reopen with a reason", async () => {
  const jobId = await openJob();
  const override = await setStatus(jobId, TEST_MATCHING_TOKEN, {
    status: "closed",
    reason: "Client collected early; paperwork completed offline",
  });
  assert.equal(override.status, 201);

  const noReason = await setStatus(jobId, TEST_MATCHING_TOKEN, {
    status: "in_progress",
  });
  assert.equal(noReason.status, 400);
  const reopened = await setStatus(jobId, TEST_MATCHING_TOKEN, {
    status: "in_progress",
    reason: "Consignee reported missing documents",
  });
  assert.equal(reopened.status, 201);
  const job = (await reopened.json()) as {
    status: string;
    closedAt: string | null;
  };
  assert.equal(job.status, "in_progress");
  assert.equal(job.closedAt, null);

  const history = (await (
    await call(`/api/v1/jobs/${jobId}/status-history`, TEST_SUPER_ADMIN_TOKEN)
  ).json()) as { history: Array<{ reason: string | null }> };
  assert.equal(
    history.history[0].reason,
    "Client collected early; paperwork completed offline",
  );
  assert.equal(
    history.history[1].reason,
    "Consignee reported missing documents",
  );
});

test("closed jobs refuse milestones until reopened; the super admin may also act", async () => {
  const jobId = await openJob();
  await setStatus(jobId, TEST_SUPER_ADMIN_TOKEN, {
    status: "cancelled",
    reason: "Client withdrew",
  });
  const blocked = await call(
    `/api/v1/jobs/${jobId}/milestones`,
    TEST_SUPER_ADMIN_TOKEN,
    {
      method: "POST",
      body: JSON.stringify({ milestoneKey: "cargo_arrived" }),
    },
  );
  assert.equal(blocked.status, 409);
  await setStatus(jobId, TEST_SUPER_ADMIN_TOKEN, {
    status: "in_progress",
    reason: "Client returned",
  });
  const allowed = await call(
    `/api/v1/jobs/${jobId}/milestones`,
    TEST_SUPER_ADMIN_TOKEN,
    {
      method: "POST",
      body: JSON.stringify({ milestoneKey: "cargo_arrived" }),
    },
  );
  assert.equal(allowed.status, 201);
});

test("other departments and customers cannot change a job's status", async () => {
  const jobId = await openJob();
  assert.equal(
    (await setStatus(jobId, TEST_UNASSIGNED_TOKEN, { status: "in_progress" }))
      .status,
    404,
  );
  assert.equal(
    (await setStatus(jobId, TEST_CUSTOMER_A_TOKEN, { status: "in_progress" }))
      .status,
    403,
  );
  const stillOpen = (await (
    await call(`/api/v1/jobs/${jobId}`, TEST_SUPER_ADMIN_TOKEN)
  ).json()) as {
    status: string;
  };
  assert.equal(stillOpen.status, "open");
  assert.equal(
    (await call(`/api/v1/jobs/${jobId}/status-history`, TEST_UNASSIGNED_TOKEN))
      .status,
    404,
  );
  assert.equal(
    (await call(`/api/v1/jobs/${jobId}/status-history`, TEST_CUSTOMER_A_TOKEN))
      .status,
    200,
  );
});
