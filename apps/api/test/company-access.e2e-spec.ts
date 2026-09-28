import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { INestApplication } from "@nestjs/common";
import { after, before, test } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TEST_CUSTOMER_A_ID,
  TEST_CUSTOMER_A_TOKEN,
  TEST_CUSTOMER_B_ID,
  TEST_CUSTOMER_B_TOKEN,
  TEST_SUPER_ADMIN_ID,
  TEST_SUPER_ADMIN_TOKEN,
  TEST_UNASSIGNED_TOKEN,
  TEST_UNASSIGNED_USER_ID,
} from "./test-application";
import { createTestApplication } from "./test-application";
import { DatabasePort } from "../src/database/database.port";

let temporaryDirectory: string;
let application: INestApplication;
let baseUrl: string;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalDatabaseUrl = process.env.DATABASE_URL;

let companyA: string;
let companyB: string;
let requestA: string;
let requestB: string;

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "bjh-company-access-"));
  process.env.DATABASE_PATH = join(temporaryDirectory, "company-access.sqlite");
  delete process.env.DATABASE_URL;
  const started = await createTestApplication();
  application = started.application;
  baseUrl = started.baseUrl;
  await application
    .get(DatabasePort)
    .assignStaffRole(
      TEST_UNASSIGNED_USER_ID,
      "air_import_rep",
      TEST_SUPER_ADMIN_ID,
    );

  companyA = await createCompany("Northstar Synthetic Ltd");
  companyB = await createCompany("Southwind Synthetic Ltd");
  requestA = await createRequest("northstar@example.test", companyA);
  requestB = await createRequest("southwind@example.test", companyB);
  await saveDraft(requestA, "Northstar internal draft");
  await saveDraft(requestB, "Southwind internal draft");
  await grantMembership(TEST_CUSTOMER_A_ID, companyA);
  await grantMembership(TEST_CUSTOMER_B_ID, companyB);
});

after(async () => {
  await application?.close();
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

function call(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function createCompany(companyName: string): Promise<string> {
  const response = await call("/api/v1/customers", TEST_SUPER_ADMIN_TOKEN, {
    method: "POST",
    body: JSON.stringify({
      companyName,
      contactName: "Synthetic Contact",
      email: "contact@example.test",
    }),
  });
  assert.equal(response.status, 201);
  return ((await response.json()) as { id: string }).id;
}

async function createRequest(
  email: string,
  companyId: string,
): Promise<string> {
  const created = await call("/api/v1/quote-requests", TEST_SUPER_ADMIN_TOKEN, {
    method: "POST",
    body: JSON.stringify({
      companyName: "Synthetic Quote Request",
      contactName: "Synthetic Contact",
      email,
      message: "Synthetic access-control fixture",
    }),
  });
  assert.equal(created.status, 201);
  const requestId = ((await created.json()) as { id: string }).id;
  const associated = await call(
    `/api/v1/quote-requests/${requestId}/customer`,
    TEST_SUPER_ADMIN_TOKEN,
    { method: "PATCH", body: JSON.stringify({ customerCompanyId: companyId }) },
  );
  assert.equal(associated.status, 200);
  return requestId;
}

async function saveDraft(requestId: string, content: string): Promise<void> {
  const response = await call(
    `/api/v1/quote-requests/${requestId}/draft`,
    TEST_SUPER_ADMIN_TOKEN,
    { method: "PUT", body: JSON.stringify({ content }) },
  );
  assert.equal(response.status, 200);
}

async function grantMembership(
  userId: string,
  companyId: string,
): Promise<void> {
  const response = await call(
    "/api/v1/admin/company-memberships",
    TEST_SUPER_ADMIN_TOKEN,
    { method: "POST", body: JSON.stringify({ userId, companyId }) },
  );
  assert.equal(response.status, 201);
}

test("customer memberships scope customer searches, records, requests and drafts", async () => {
  const customers = await call("/api/v1/customers", TEST_CUSTOMER_A_TOKEN);
  assert.equal(customers.status, 200);
  assert.deepEqual(
    ((await customers.json()) as Array<{ id: string }>).map(({ id }) => id),
    [companyA],
  );

  const crossCompanySearch = await call(
    "/api/v1/customers?search=Southwind",
    TEST_CUSTOMER_A_TOKEN,
  );
  assert.deepEqual(await crossCompanySearch.json(), []);

  const ownCompany = await call(
    `/api/v1/customers/${companyA}`,
    TEST_CUSTOMER_A_TOKEN,
  );
  assert.equal(ownCompany.status, 200);
  const knownOtherCompany = await call(
    `/api/v1/customers/${companyB}`,
    TEST_CUSTOMER_A_TOKEN,
  );
  assert.equal(knownOtherCompany.status, 404);

  const ownRequests = await call(
    "/api/v1/quote-requests",
    TEST_CUSTOMER_A_TOKEN,
  );
  assert.equal(ownRequests.status, 200);
  assert.deepEqual(
    ((await ownRequests.json()) as Array<{ id: string }>).map(({ id }) => id),
    [requestA],
  );
  const spoofedCompanyFilter = await call(
    `/api/v1/quote-requests?customerCompanyId=${companyB}`,
    TEST_CUSTOMER_A_TOKEN,
  );
  assert.deepEqual(await spoofedCompanyFilter.json(), []);
  assert.equal(
    (await call(`/api/v1/quote-requests/${requestB}`, TEST_CUSTOMER_A_TOKEN))
      .status,
    404,
  );
  assert.equal(
    (
      await call(
        `/api/v1/quote-requests/${requestB}/draft`,
        TEST_CUSTOMER_A_TOKEN,
      )
    ).status,
    404,
  );

  const staffCanSearchBoth = await call(
    "/api/v1/customers",
    TEST_SUPER_ADMIN_TOKEN,
  );
  assert.equal(staffCanSearchBoth.status, 200);
  assert.equal(((await staffCanSearchBoth.json()) as unknown[]).length, 2);
});

test("department staff can read shared records but cannot edit or read drafts", async () => {
  const customers = await call("/api/v1/customers", TEST_UNASSIGNED_TOKEN);
  assert.equal(customers.status, 200);
  assert.equal(((await customers.json()) as unknown[]).length, 2);

  const requests = await call("/api/v1/quote-requests", TEST_UNASSIGNED_TOKEN);
  assert.equal(requests.status, 200);
  assert.equal(((await requests.json()) as unknown[]).length, 2);
  assert.equal(
    (await call(`/api/v1/quote-requests/${requestB}`, TEST_UNASSIGNED_TOKEN))
      .status,
    200,
  );

  assert.equal(
    (
      await call(
        `/api/v1/quote-requests/${requestA}/draft`,
        TEST_UNASSIGNED_TOKEN,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/api/v1/customers", TEST_UNASSIGNED_TOKEN, {
        method: "POST",
        body: JSON.stringify({
          companyName: "Unauthorized Synthetic Co",
          contactName: "Synthetic User",
          email: "unauthorized@example.test",
        }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/api/v1/quote-requests", TEST_UNASSIGNED_TOKEN, {
        method: "POST",
        body: JSON.stringify({
          companyName: "Unauthorized Synthetic Co",
          contactName: "Synthetic User",
          email: "unauthorized@example.test",
          message: "Synthetic request",
        }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/api/v1/quote-requests/${requestA}/customer`,
        TEST_UNASSIGNED_TOKEN,
        {
          method: "PATCH",
          body: JSON.stringify({ customerCompanyId: companyA }),
        },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/api/v1/quote-requests/${requestA}/draft`,
        TEST_UNASSIGNED_TOKEN,
        { method: "PUT", body: JSON.stringify({ content: "Unauthorized" }) },
      )
    ).status,
    403,
  );
});

test("membership revocation removes access and preserves history", async () => {
  const revoked = await call(
    `/api/v1/admin/company-memberships/${TEST_CUSTOMER_A_ID}/${companyA}`,
    TEST_SUPER_ADMIN_TOKEN,
    { method: "DELETE" },
  );
  assert.equal(revoked.status, 200);
  assert.equal(
    (await call(`/api/v1/customers/${companyA}`, TEST_CUSTOMER_A_TOKEN)).status,
    403,
  );

  const history = await call(
    `/api/v1/admin/company-memberships?userId=${TEST_CUSTOMER_A_ID}`,
    TEST_SUPER_ADMIN_TOKEN,
  );
  const memberships = (await history.json()) as Array<{
    companyId: string;
    revokedAt: string | null;
  }>;
  assert.equal(memberships.length, 1);
  assert.equal(memberships[0].companyId, companyA);
  assert.ok(memberships[0].revokedAt);

  assert.equal(
    (await call("/api/v1/customers", TEST_CUSTOMER_A_TOKEN)).status,
    403,
  );
});

test("only a super admin can grant or revoke customer-company access", async () => {
  const denied = await call(
    "/api/v1/admin/company-memberships",
    TEST_CUSTOMER_B_TOKEN,
    {
      method: "POST",
      body: JSON.stringify({ userId: TEST_CUSTOMER_B_ID, companyId: companyB }),
    },
  );
  assert.equal(denied.status, 403);
});
