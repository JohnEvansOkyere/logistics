import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { after, before, test } from "node:test";
import {
  TEST_CUSTOMER_A_ID,
  TEST_CUSTOMER_A_TOKEN,
  TEST_CUSTOMER_B_ID,
  TEST_CUSTOMER_B_TOKEN,
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
let seaJobId: string;
let otherSeaJobId: string;
let airJobId: string;

function call(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

function record(jobId: string, token: string, body: unknown) {
  return call(`/api/v1/jobs/${jobId}/milestones`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function openJob(
  companyId: string,
  serviceLine: string,
): Promise<string> {
  const response = await call("/api/v1/jobs", TEST_SUPER_ADMIN_TOKEN, {
    method: "POST",
    body: JSON.stringify({ customerCompanyId: companyId, serviceLine }),
  });
  return ((await response.json()) as { id: string }).id;
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
  const companyA = randomUUID();
  const companyB = randomUUID();
  for (const [id, name] of [
    [companyA, "Northstar Synthetic Ltd"],
    [companyB, "Southwind Synthetic Ltd"],
  ]) {
    await database.createCustomer({
      id,
      companyName: name,
      createdAt: new Date().toISOString(),
      contacts: [],
    });
  }
  await database.grantCustomerMembership(
    companyA,
    TEST_CUSTOMER_A_ID,
    TEST_SUPER_ADMIN_ID,
  );
  await database.grantCustomerMembership(
    companyB,
    TEST_CUSTOMER_B_ID,
    TEST_SUPER_ADMIN_ID,
  );
  seaJobId = await openJob(companyA, "sea_import");
  otherSeaJobId = await openJob(companyB, "sea_import");
  airJobId = await openJob(companyA, "air_import");
});

after(async () => {
  await application?.close();
  await endTestDatabase();
});

let arrivedEventId: string;

test("a rep records a milestone on their job and it appears on the timeline", async () => {
  const response = await record(seaJobId, TEST_MATCHING_TOKEN, {
    milestoneKey: "cargo_arrived",
    occurredAt: "2026-09-20T08:30:00Z",
    note: "  Vessel berthed  ",
  });
  assert.equal(response.status, 201);
  const event = (await response.json()) as Record<string, unknown>;
  assert.equal(event.milestoneKey, "cargo_arrived");
  assert.equal(event.occurredAt, "2026-09-20T08:30:00.000Z");
  assert.equal(event.note, "Vessel berthed");
  assert.equal(event.source, "manual");
  assert.equal(event.recordedBy, TEST_MATCHING_USER_ID);
  arrivedEventId = String(event.id);

  const timeline = (await (
    await call(`/api/v1/jobs/${seaJobId}/milestones`, TEST_MATCHING_TOKEN)
  ).json()) as {
    template: Array<{ key: string }>;
    events: Array<{ id: string }>;
  };
  assert.equal(timeline.template.length, 14);
  assert.equal(timeline.template[0].key, "cargo_arrived");
  assert.deepEqual(
    timeline.events.map((item) => item.id),
    [arrivedEventId],
  );
});

test("corrections are new events; the original is kept", async () => {
  const correction = await record(seaJobId, TEST_SUPER_ADMIN_TOKEN, {
    milestoneKey: "cargo_arrived",
    occurredAt: "2026-09-21T08:30:00Z",
    note: "Wrong day recorded",
    correctionOf: arrivedEventId,
  });
  assert.equal(correction.status, 201);
  const timeline = (await (
    await call(`/api/v1/jobs/${seaJobId}/milestones`, TEST_SUPER_ADMIN_TOKEN)
  ).json()) as { events: Array<{ id: string; correctionOf: string | null }> };
  assert.equal(timeline.events.length, 2);
  assert.equal(timeline.events[1].correctionOf, arrivedEventId);

  const foreign = await record(otherSeaJobId, TEST_SUPER_ADMIN_TOKEN, {
    milestoneKey: "cargo_arrived",
    correctionOf: arrivedEventId,
  });
  assert.equal(foreign.status, 404);
  const unknown = await record(seaJobId, TEST_SUPER_ADMIN_TOKEN, {
    milestoneKey: "cargo_arrived",
    correctionOf: randomUUID(),
  });
  assert.equal(unknown.status, 404);
});

test("invalid milestone requests are rejected", async () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const cases: Array<[unknown, number, string]> = [
    [[], 400, "A milestone object is required"],
    [{}, 400, "milestoneKey is required"],
    [
      { milestoneKey: "teleported" },
      400,
      "milestoneKey is not part of this service line's milestones",
    ],
    [
      { milestoneKey: "cargo_arrived", occurredAt: "yesterday-ish" },
      400,
      "occurredAt must be a date and time",
    ],
    [
      { milestoneKey: "cargo_arrived", occurredAt: future },
      400,
      "occurredAt cannot be in the future",
    ],
    [
      { milestoneKey: "cargo_arrived", note: "x".repeat(2001) },
      400,
      "note must be at most 2000 characters",
    ],
    [
      { milestoneKey: "cargo_arrived", correctionOf: "nope" },
      400,
      "correctionOf must be a valid ID",
    ],
  ];
  for (const [body, status, message] of cases) {
    const response = await record(seaJobId, TEST_SUPER_ADMIN_TOKEN, body);
    assert.equal(response.status, status, message);
    assert.equal(
      ((await response.json()) as { message: string }).message,
      message,
    );
  }
});

test("service lines without an agreed template refuse milestones", async () => {
  const response = await record(airJobId, TEST_SUPER_ADMIN_TOKEN, {
    milestoneKey: "cargo_arrived",
  });
  assert.equal(response.status, 409);
});

test("access boundaries: other departments and companies cannot read or write", async () => {
  const wrongDepartment = await record(seaJobId, TEST_UNASSIGNED_TOKEN, {
    milestoneKey: "cargo_arrived",
  });
  assert.equal(wrongDepartment.status, 404);
  const wrongDepartmentRead = await call(
    `/api/v1/jobs/${seaJobId}/milestones`,
    TEST_UNASSIGNED_TOKEN,
  );
  assert.equal(wrongDepartmentRead.status, 404);

  const customerWrite = await record(seaJobId, TEST_CUSTOMER_A_TOKEN, {
    milestoneKey: "cargo_arrived",
  });
  assert.equal(customerWrite.status, 403);
  const customerRead = await call(
    `/api/v1/jobs/${seaJobId}/milestones`,
    TEST_CUSTOMER_A_TOKEN,
  );
  assert.equal(customerRead.status, 200);
  const otherCustomerRead = await call(
    `/api/v1/jobs/${seaJobId}/milestones`,
    TEST_CUSTOMER_B_TOKEN,
  );
  assert.equal(otherCustomerRead.status, 404);
  const anonymous = await fetch(
    `${baseUrl}/api/v1/jobs/${seaJobId}/milestones`,
  );
  assert.equal(anonymous.status, 401);
});
