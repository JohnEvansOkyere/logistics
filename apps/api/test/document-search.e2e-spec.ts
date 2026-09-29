import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { after, before, test } from "node:test";
import {
  TEST_CUSTOMER_A_ID,
  TEST_CUSTOMER_B_ID,
  TEST_CUSTOMER_A_TOKEN,
  TEST_CUSTOMER_B_TOKEN,
  TEST_SUPER_ADMIN_ID,
  TEST_SUPER_ADMIN_TOKEN,
  createTestApplication,
} from "./test-application";
import { DatabasePort } from "../src/database/database.port";
import {
  beginTestDatabase,
  endTestDatabase,
  testPostgresPool,
} from "./postgres-test-database";

let application: INestApplication;
let baseUrl: string;
const oldJobId = randomUUID();

function call(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function search(term: string, token = TEST_SUPER_ADMIN_TOKEN) {
  const response = await call(
    `/api/v1/jobs?search=${encodeURIComponent(term)}`,
    token,
  );
  const body = (await response.json()) as Array<{ id: string }>;
  assert.ok(
    Array.isArray(body),
    `${token} ${term} ${response.status} ${JSON.stringify(body)}`,
  );
  return body.map((job) => job.id);
}

before(async () => {
  await beginTestDatabase();
  const started = await createTestApplication();
  application = started.application;
  baseUrl = started.baseUrl;
  const database = application.get(DatabasePort);
  const companyId = randomUUID();
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
  const otherCompanyId = randomUUID();
  await database.createCustomer({
    id: otherCompanyId,
    companyName: "Southwind Synthetic Ltd",
    createdAt: new Date().toISOString(),
    contacts: [],
  });
  await database.grantCustomerMembership(
    otherCompanyId,
    TEST_CUSTOMER_B_ID,
    TEST_SUPER_ADMIN_ID,
  );

  // A job from three years ago, with an old document, as it would exist in the archive.
  await testPostgresPool.query(
    `INSERT INTO app.job (job_id, file_number, service_line, customer_company_id, opened_by, opened_at)
     VALUES ($1::uuid, 'BJH/SI/2023/0042', 'sea_import', $2::uuid, $3::uuid, '2023-05-17T09:00:00Z')`,
    [oldJobId, companyId, TEST_SUPER_ADMIN_ID],
  );
  await testPostgresPool.query(
    `INSERT INTO app.shipment_reference (job_id, kind, reference_value, created_by)
     VALUES ($1::uuid, 'house_bl', 'HBL-2023-SYN-9', $2::uuid)`,
    [oldJobId, TEST_SUPER_ADMIN_ID],
  );
  const document = await testPostgresPool.query(
    `INSERT INTO app.document (job_id, document_type, created_by, created_at)
     VALUES ($1::uuid, 'bill_of_lading', $2::uuid, '2023-05-20T10:00:00Z') RETURNING document_id`,
    [oldJobId, TEST_SUPER_ADMIN_ID],
  );
  await testPostgresPool.query(
    `INSERT INTO app.document_version
       (document_id, version_number, original_filename, content_type, size_bytes, sha256, object_key, uploaded_by)
     VALUES ($1::uuid, 1, 'Signed BL Copy.pdf', 'application/pdf', 100, repeat('a', 64), $2, $3::uuid)`,
    [
      document.rows[0].document_id,
      `${oldJobId}/${randomUUID()}`,
      TEST_SUPER_ADMIN_ID,
    ],
  );
  const created = await call("/api/v1/jobs", TEST_SUPER_ADMIN_TOKEN, {
    method: "POST",
    body: JSON.stringify({
      customerCompanyId: companyId,
      serviceLine: "sea_import",
    }),
  });
  assert.equal(created.status, 201);
  assert.notEqual(((await created.json()) as { id: string }).id, oldJobId);
});

after(async () => {
  await application?.close();
  await endTestDatabase();
});

test("an old job is retrievable in one search by any of its identifiers", async () => {
  for (const term of [
    "BJH/SI/2023/0042", // file number
    "Northstar", // customer
    "HBL-2023-SYN-9", // house B/L
    "bill of lading", // document type
    "Signed BL", // document name
    "2023-05-17", // job date
    "2023-05-20", // upload date
    "2023", // year
  ]) {
    const found = await search(term);
    assert.ok(found.includes(oldJobId), `"${term}" finds the old job`);
  }
  assert.equal(
    (await search("2023")).length,
    1,
    "the year only matches the old job",
  );
});

test("search results stay inside the caller's company", async () => {
  assert.ok(
    (await search("Signed BL", TEST_CUSTOMER_A_TOKEN)).includes(oldJobId),
  );
  assert.deepEqual(await search("Signed BL", TEST_CUSTOMER_B_TOKEN), []);
  assert.deepEqual(await search("2023-05-17", TEST_CUSTOMER_B_TOKEN), []);
});
