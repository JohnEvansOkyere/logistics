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
let companyA: string;
let jobA: string;
let jobB: string;
let attachmentA: string;
let attachmentB: string;

function call(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}
const post = (path: string, token: string, body: unknown) =>
  call(path, token, { method: "POST", body: JSON.stringify(body) });
const get = (path: string, token = TEST_MATCHING_TOKEN) => call(path, token);
const message = async (response: Response) =>
  ((await response.json()) as { message: string }).message;

async function openJob(companyId: string) {
  const response = await post("/api/v1/jobs", TEST_SUPER_ADMIN_TOKEN, {
    customerCompanyId: companyId,
    serviceLine: "sea_import",
  });
  return ((await response.json()) as { id: string }).id;
}

async function attachment(jobId: string) {
  const form = new FormData();
  form.append("documentType", "office_letter");
  form.append(
    "file",
    new Blob(
      [new Uint8Array(Buffer.from(`%PDF-1.4\n% ${randomUUID()}\n%%EOF\n`))],
      { type: "application/pdf" },
    ),
    "email-printout.pdf",
  );
  const response = await call(
    `/api/v1/jobs/${jobId}/documents`,
    TEST_MATCHING_TOKEN,
    {
      method: "POST",
      body: form,
    },
  );
  return ((await response.json()) as { id: string }).id;
}

type Entry = {
  id: string;
  channel: string;
  direction: string;
  occurredAt: string;
  counterparty: string | null;
  subject: string | null;
  body: string;
  documentId: string | null;
  recordedBy: string;
};

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
  companyA = randomUUID();
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
  jobA = await openJob(companyA);
  jobB = await openJob(companyB);
  attachmentA = await attachment(jobA);
  attachmentB = await attachment(jobB);
});

after(async () => {
  await application?.close();
  await endTestDatabase();
});

test("staff log what was said, newest exchange first, with an optional attachment", async () => {
  const path = `/api/v1/jobs/${jobA}/correspondence`;
  const first = await post(path, TEST_MATCHING_TOKEN, {
    channel: "email",
    direction: "received",
    occurredAt: "2026-09-20T08:30:00Z",
    counterparty: "  Ama Synthetic (Northstar)  ",
    subject: "  Demurrage query ",
    body: "  Can you confirm the demurrage days before the vessel arrives?  ",
    documentId: attachmentA,
  });
  assert.equal(first.status, 201);
  const entry = (await first.json()) as Entry;
  assert.equal(entry.channel, "email");
  assert.equal(entry.direction, "received");
  assert.equal(entry.occurredAt, "2026-09-20T08:30:00.000Z");
  assert.equal(entry.counterparty, "Ama Synthetic (Northstar)");
  assert.equal(entry.subject, "Demurrage query");
  assert.equal(
    entry.body,
    "Can you confirm the demurrage days before the vessel arrives?",
  );
  assert.equal(entry.documentId, attachmentA);

  const second = await post(path, TEST_MATCHING_TOKEN, {
    channel: "whatsapp",
    direction: "sent",
    body: "Confirmed: three free days.",
  });
  assert.equal(second.status, 201);
  const now = Date.parse(((await second.json()) as Entry).occurredAt);
  assert.ok(Math.abs(now - Date.now()) < 60_000);

  const listed = (await (await get(path)).json()) as Entry[];
  assert.deepEqual(
    listed.map((item) => item.channel),
    ["whatsapp", "email"],
  );
});

test("invalid entries are rejected", async () => {
  const path = `/api/v1/jobs/${jobA}/correspondence`;
  const valid = {
    channel: "phone",
    direction: "received",
    body: "Called about the release.",
  };
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ ...valid, body: undefined }, "body is required"],
    [{ ...valid, body: "   " }, "body must contain 1 to 20000 characters"],
    [
      { ...valid, channel: "telegram" },
      "channel must be one of email, whatsapp, sms, phone, letter, other",
    ],
    [{ ...valid, direction: "both" }, "direction must be received or sent"],
    [
      { ...valid, occurredAt: "yesterday-ish" },
      "occurredAt must be a date and time",
    ],
    [
      { ...valid, occurredAt: new Date(Date.now() + 3_600_000).toISOString() },
      "occurredAt cannot be in the future",
    ],
    [{ ...valid, documentId: "nope" }, "documentId must be a valid ID"],
    [
      { ...valid, documentId: attachmentB },
      "documentId must be a document on this job",
    ],
    [
      { ...valid, documentId: randomUUID() },
      "documentId must be a document on this job",
    ],
  ];
  for (const [body, expected] of cases) {
    const response = await post(path, TEST_MATCHING_TOKEN, body);
    assert.equal(response.status, 400, expected);
    assert.equal(await message(response), expected);
  }
});

test("the log is internal: customers and other departments never reach it", async () => {
  const path = `/api/v1/jobs/${jobA}/correspondence`;
  const body = { channel: "email", direction: "sent", body: "x" };
  for (const token of [TEST_CUSTOMER_A_TOKEN, TEST_CUSTOMER_B_TOKEN]) {
    assert.equal((await get(path, token)).status, 403);
    assert.equal((await post(path, token, body)).status, 403);
  }
  // A rep for another service line cannot see this job at all.
  assert.equal((await get(path, TEST_UNASSIGNED_TOKEN)).status, 404);
  assert.equal((await post(path, TEST_UNASSIGNED_TOKEN, body)).status, 404);
  assert.equal(
    (await get(`/api/v1/jobs/${randomUUID()}/correspondence`)).status,
    404,
  );
  assert.equal((await get(path, TEST_SUPER_ADMIN_TOKEN)).status, 200);
});

test("entries cannot be edited or removed through the API", async () => {
  const path = `/api/v1/jobs/${jobA}/correspondence`;
  const [entry] = (await (await get(path)).json()) as Entry[];
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    const response = await call(`${path}/${entry.id}`, TEST_SUPER_ADMIN_TOKEN, {
      method,
    });
    assert.equal(response.status, 404, method);
  }
});

test("a client can write after the file is closed, so logging stays open", async () => {
  for (const status of ["in_progress", "ready_to_close", "closed"]) {
    assert.equal(
      (
        await post(`/api/v1/jobs/${jobA}/status`, TEST_MATCHING_TOKEN, {
          status,
        })
      ).status,
      201,
    );
  }
  const late = await post(
    `/api/v1/jobs/${jobA}/correspondence`,
    TEST_MATCHING_TOKEN,
    {
      channel: "email",
      direction: "received",
      body: "Thank you, all received.",
    },
  );
  assert.equal(late.status, 201);
});

test("staff find a job by what was logged; customers never can", async () => {
  const search = async (term: string, token: string) =>
    (
      (await (
        await get(`/api/v1/jobs?search=${encodeURIComponent(term)}`, token)
      ).json()) as Array<{
        id: string;
      }>
    ).map((job) => job.id);

  assert.deepEqual(await search("demurrage days", TEST_MATCHING_TOKEN), [jobA]);
  assert.deepEqual(await search("DEMURRAGE QUERY", TEST_SUPER_ADMIN_TOKEN), [
    jobA,
  ]);
  assert.deepEqual(await search("ama synthetic", TEST_MATCHING_TOKEN), [jobA]);
  assert.deepEqual(await search("no such words", TEST_MATCHING_TOKEN), []);
  // The department for another line does not find it either.
  assert.deepEqual(await search("demurrage", TEST_UNASSIGNED_TOKEN), []);
  // The customer whose job it is finds it by a public field but not by the internal log.
  assert.deepEqual(await search("demurrage", TEST_CUSTOMER_A_TOKEN), []);
  assert.deepEqual(await search("Northstar", TEST_CUSTOMER_A_TOKEN), [jobA]);
  assert.deepEqual(await search("demurrage", TEST_CUSTOMER_B_TOKEN), []);
});
