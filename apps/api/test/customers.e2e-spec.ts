import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { NestFactory } from "@nestjs/core";

let temporaryDirectory: string;
let baseUrl: string;
let application: Awaited<ReturnType<typeof NestFactory.create>>;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalDatabaseUrl = process.env.DATABASE_URL;

async function startApplication(): Promise<void> {
  const { AppModule } = await import("../src/app.module");
  application = await NestFactory.create(AppModule, { logger: false });
  await application.listen(0, "127.0.0.1");
  const address = application.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function createCustomer(input: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/customers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "bjh-customers-"));
  process.env.DATABASE_PATH = join(temporaryDirectory, "customers.sqlite");
  delete process.env.DATABASE_URL;
  await startApplication();
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
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("customers can be created, searched, and retrieved with contacts", async () => {
  const response = await createCustomer({
    companyName: "  Northstar Demo Ltd  ",
    contactName: "  Alex Demo  ",
    email: "alex@northstar-demo.test",
  });

  assert.equal(response.status, 201, await response.clone().text());
  const created = (await response.json()) as {
    id: string;
    companyName: string;
    createdAt: string;
    contacts: Array<{
      id: string;
      name: string;
      email: string;
      createdAt: string;
    }>;
  };
  assert.equal(created.companyName, "Northstar Demo Ltd");
  assert.equal(created.contacts.length, 1);
  assert.equal(created.contacts[0]?.name, "Alex Demo");
  assert.equal(created.contacts[0]?.email, "alex@northstar-demo.test");
  assert.ok(Number.isFinite(Date.parse(created.createdAt)));

  for (const search of ["northstar", "alex demo", "northstar-demo.test"]) {
    const listResponse = await fetch(
      `${baseUrl}/api/v1/customers?search=${encodeURIComponent(search)}`,
    );
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), [created]);
  }

  const detailResponse = await fetch(
    `${baseUrl}/api/v1/customers/${created.id}`,
  );
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(await detailResponse.json(), created);
});

test("same-name customer submissions remain separate records", async () => {
  const first = await createCustomer({
    companyName: "Repeated Demo Ltd",
    contactName: "First Contact",
    email: "first@example.test",
  });
  const second = await createCustomer({
    companyName: "Repeated Demo Ltd",
    contactName: "Second Contact",
    email: "second@example.test",
  });

  const firstCustomer = (await first.json()) as { id: string };
  const secondCustomer = (await second.json()) as { id: string };
  assert.notEqual(firstCustomer.id, secondCustomer.id);

  const searchResponse = await fetch(
    `${baseUrl}/api/v1/customers?search=Repeated%20Demo`,
  );
  const matches = (await searchResponse.json()) as Array<{ id: string }>;
  assert.equal(matches.length, 2);
});

test("invalid customers and unknown customer IDs fail safely", async () => {
  const invalidResponse = await createCustomer({
    companyName: "Example Ltd",
    contactName: "Alex Demo",
    email: "invalid-email",
  });
  assert.equal(invalidResponse.status, 400);

  const oversizeSearch = await fetch(
    `${baseUrl}/api/v1/customers?search=${"x".repeat(201)}`,
  );
  assert.equal(oversizeSearch.status, 400);

  const missingResponse = await fetch(
    `${baseUrl}/api/v1/customers/unknown-customer`,
  );
  assert.equal(missingResponse.status, 404);
});

test("customer companies and contacts persist after an API restart", async () => {
  const response = await createCustomer({
    companyName: "Restart Demo Ltd",
    contactName: "Taylor Demo",
    email: "taylor@example.test",
  });
  const created = (await response.json()) as { id: string };

  await application.close();
  await startApplication();

  const detailResponse = await fetch(
    `${baseUrl}/api/v1/customers/${created.id}`,
  );
  assert.equal(detailResponse.status, 200);
  const customer = (await detailResponse.json()) as {
    contacts: Array<{ email: string }>;
  };
  assert.equal(customer.contacts[0]?.email, "taylor@example.test");
});
