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
let companyB: string;
let seaJobA: string;
let seaJobB: string;

const pdf = (extra: string) =>
  Buffer.from(`%PDF-1.4\n% ${extra}\n%%EOF\n`, "latin1");

interface LibraryRow {
  id: string;
  jobId: string | null;
  fileNumber: string | null;
  companyName: string | null;
  title: string | null;
  documentType: string;
  versionCount: number;
  latest: { filename: string; objectKey?: string };
}

function call(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

function post(path: string, token: string, body: unknown) {
  return call(path, token, { method: "POST", body: JSON.stringify(body) });
}

function uploadToLibrary(
  token: string,
  filename: string,
  fields: Record<string, string>,
  bytes: Buffer = pdf(filename),
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    filename,
  );
  return call("/api/v1/documents", token, { method: "POST", body: form });
}

async function search(token: string, query = "") {
  const response = await call(
    `/api/v1/documents?${new URLSearchParams(query ? { search: query } : {})}`,
    token,
  );
  assert.equal(response.status, 200);
  return (await response.json()) as LibraryRow[];
}

async function openJob(companyId: string, serviceLine: string) {
  const response = await post("/api/v1/jobs", TEST_SUPER_ADMIN_TOKEN, {
    customerCompanyId: companyId,
    serviceLine,
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
  companyA = randomUUID();
  companyB = randomUUID();
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
  seaJobA = await openJob(companyA, "sea_import");
  seaJobB = await openJob(companyB, "sea_import");
  const reference = await post(
    `/api/v1/jobs/${seaJobA}/references`,
    TEST_SUPER_ADMIN_TOKEN,
    { kind: "master_bl", value: "MAEU99887766" },
  );
  assert.equal(reference.status, 201);
  const otherCompanyDocument = await uploadToLibrary(
    TEST_SUPER_ADMIN_TOKEN,
    "southwind-bl.pdf",
    { documentType: "bill_of_lading", jobId: seaJobB },
  );
  assert.equal(otherCompanyDocument.status, 201);
});

after(async () => {
  await application?.close();
  await endTestDatabase();
});

test("staff upload standalone, job-linked and company-linked documents; the key never leaves the API", async () => {
  const letter = await uploadToLibrary(
    TEST_MATCHING_TOKEN,
    "customs-circular.pdf",
    { documentType: "office_letter", title: "Customs circular October" },
  );
  assert.equal(letter.status, 201);
  const text = await letter.text();
  assert.equal(text.includes("objectKey"), false);
  const row = JSON.parse(text) as LibraryRow;
  assert.equal(row.jobId, null);
  assert.equal(row.companyName, null);
  assert.equal(row.title, "Customs circular October");

  const forJob = await uploadToLibrary(TEST_MATCHING_TOKEN, "bl-maersk.pdf", {
    documentType: "bill_of_lading",
    jobId: seaJobA,
  });
  assert.equal(forJob.status, 201);
  const jobRow = (await forJob.json()) as LibraryRow;
  assert.match(jobRow.fileNumber ?? "", /^BJH\/SI\//);
  assert.equal(jobRow.companyName, "Northstar Synthetic Ltd");

  const forCompany = await uploadToLibrary(
    TEST_MATCHING_TOKEN,
    "rate-agreement.pdf",
    { documentType: "other", companyId: companyA, title: "Rate agreement" },
  );
  assert.equal(forCompany.status, 201);

  // A job's document also shows on the job's own documents tab.
  const onJob = (await (
    await call(`/api/v1/jobs/${seaJobA}/documents`, TEST_MATCHING_TOKEN)
  ).json()) as Array<{ id: string }>;
  assert.ok(onJob.some((document) => document.id === jobRow.id));
});

test("one search finds a document by title, file name, file number, company, B/L number, type or date", async () => {
  const ids = async (query: string) =>
    (await search(TEST_SUPER_ADMIN_TOKEN, query)).map(
      (row) => row.latest.filename,
    );
  assert.deepEqual(await ids("circular"), ["customs-circular.pdf"]);
  assert.deepEqual(await ids("RATE-AGREEMENT"), ["rate-agreement.pdf"]);
  assert.ok((await ids("maeu99887766")).includes("bl-maersk.pdf"));
  assert.ok((await ids("BJH/SI")).includes("bl-maersk.pdf"));
  assert.ok((await ids("bill of lading")).includes("bl-maersk.pdf"));
  assert.ok((await ids("northstar")).includes("rate-agreement.pdf"));
  assert.ok(
    (await ids(new Date().toISOString().slice(0, 10))).includes(
      "customs-circular.pdf",
    ),
  );
  // Every word must match; words may match different fields.
  assert.deepEqual(await ids("northstar rate"), ["rate-agreement.pdf"]);
  assert.deepEqual(await ids("northstar circular"), []);
  assert.deepEqual(await ids("no-such-thing"), []);
  assert.equal((await search(TEST_SUPER_ADMIN_TOKEN)).length, 4);

  const byType = await call(
    "/api/v1/documents?type=office_letter",
    TEST_SUPER_ADMIN_TOKEN,
  );
  assert.equal(((await byType.json()) as LibraryRow[]).length, 1);
  const badType = await call(
    "/api/v1/documents?type=nonsense",
    TEST_SUPER_ADMIN_TOKEN,
  );
  assert.equal(badType.status, 400);
});

test("visibility: reps see their service lines plus standalone documents; customers only their own company", async () => {
  const names = async (token: string) =>
    (await search(token)).map((row) => row.latest.filename).sort();
  assert.deepEqual(await names(TEST_MATCHING_TOKEN), [
    "bl-maersk.pdf",
    "customs-circular.pdf",
    "rate-agreement.pdf",
    "southwind-bl.pdf",
  ]);
  // The air-export rep has no sea-import access: the sea job's B/L stays hidden.
  assert.deepEqual(await names(TEST_UNASSIGNED_TOKEN), [
    "customs-circular.pdf",
    "rate-agreement.pdf",
  ]);
  // Customer A: their job's B/L and the document tied to their company, never the unlinked letter.
  assert.deepEqual(await names(TEST_CUSTOMER_A_TOKEN), [
    "bl-maersk.pdf",
    "rate-agreement.pdf",
  ]);
  assert.deepEqual(await names(TEST_CUSTOMER_B_TOKEN), ["southwind-bl.pdf"]);
  assert.deepEqual(await search(TEST_CUSTOMER_A_TOKEN, "circular"), []);
});

test("downloads follow the same visibility; guessed IDs are 404", async () => {
  const all = await search(TEST_SUPER_ADMIN_TOKEN);
  const byName = (name: string) =>
    all.find((row) => row.latest.filename === name)!.id;
  const letter = byName("customs-circular.pdf");
  const bl = byName("bl-maersk.pdf");
  const rate = byName("rate-agreement.pdf");
  const southwind = byName("southwind-bl.pdf");
  const link = (id: string, token: string) =>
    call(`/api/v1/documents/${id}/download`, token);

  const ok = await link(letter, TEST_MATCHING_TOKEN);
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as { url: string; filename: string };
  assert.equal(body.filename, "customs-circular.pdf");
  assert.ok(body.url.length > 0);

  assert.equal((await link(bl, TEST_CUSTOMER_A_TOKEN)).status, 200);
  assert.equal((await link(rate, TEST_CUSTOMER_A_TOKEN)).status, 200);
  assert.equal((await link(letter, TEST_CUSTOMER_A_TOKEN)).status, 404);
  assert.equal((await link(bl, TEST_CUSTOMER_B_TOKEN)).status, 404);
  assert.equal((await link(southwind, TEST_CUSTOMER_A_TOKEN)).status, 404);
  assert.equal((await link(southwind, TEST_CUSTOMER_B_TOKEN)).status, 200);
  assert.equal((await link(rate, TEST_CUSTOMER_B_TOKEN)).status, 404);
  assert.equal((await link(bl, TEST_UNASSIGNED_TOKEN)).status, 404);
  assert.equal((await link(randomUUID(), TEST_SUPER_ADMIN_TOKEN)).status, 404);
  assert.equal((await link("not-an-id", TEST_SUPER_ADMIN_TOKEN)).status, 404);
  const badVersion = await call(
    `/api/v1/documents/${letter}/download?version=0`,
    TEST_SUPER_ADMIN_TOKEN,
  );
  assert.equal(badVersion.status, 400);
});

test("upload rules: staff only, job within the rep's lines, valid owner and file", async () => {
  const asCustomer = await uploadToLibrary(TEST_CUSTOMER_A_TOKEN, "x.pdf", {
    documentType: "other",
  });
  assert.equal(asCustomer.status, 403);

  const otherLine = await uploadToLibrary(TEST_UNASSIGNED_TOKEN, "x.pdf", {
    documentType: "other",
    jobId: seaJobA,
  });
  assert.equal(otherLine.status, 404);

  const both = await uploadToLibrary(TEST_SUPER_ADMIN_TOKEN, "x.pdf", {
    documentType: "other",
    jobId: seaJobA,
    companyId: companyA,
  });
  assert.equal(both.status, 400);

  const unknownCompany = await uploadToLibrary(
    TEST_SUPER_ADMIN_TOKEN,
    "x.pdf",
    {
      documentType: "other",
      companyId: randomUUID(),
    },
  );
  assert.equal(unknownCompany.status, 404);

  const noType = await uploadToLibrary(TEST_SUPER_ADMIN_TOKEN, "x.pdf", {});
  assert.equal(noType.status, 400);

  const notAPdf = await uploadToLibrary(
    TEST_SUPER_ADMIN_TOKEN,
    "fake.pdf",
    { documentType: "other" },
    Buffer.from("MZ not a pdf"),
  );
  assert.equal(notAPdf.status, 415);

  // Nothing above left a document behind.
  assert.equal((await search(TEST_SUPER_ADMIN_TOKEN)).length, 4);
});
