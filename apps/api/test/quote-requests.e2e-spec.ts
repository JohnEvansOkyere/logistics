import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { NestFactory } from "@nestjs/core";

let temporaryDirectory: string;
let databasePath: string;
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

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "bjh-quote-requests-"));
  databasePath = join(temporaryDirectory, "requests.sqlite");
  process.env.DATABASE_PATH = databasePath;
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

test("a quote request is saved and returned by list and detail endpoints", async () => {
  const response = await fetch(`${baseUrl}/api/v1/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "  Example Demo Ltd  ",
      contactName: "  Alex Demo  ",
      email: "alex@example.test",
      message: "  Please contact me about a fictional shipment.  ",
    }),
  });

  assert.equal(response.status, 201, await response.clone().text());
  const created = (await response.json()) as {
    id: string;
    companyName: string;
    contactName: string;
    email: string;
    message: string;
    createdAt: string;
  };
  assert.match(created.id, /^[0-9a-f-]{36}$/i);
  assert.equal(created.companyName, "Example Demo Ltd");
  assert.equal(created.contactName, "Alex Demo");
  assert.equal(created.email, "alex@example.test");
  assert.equal(
    created.message,
    "Please contact me about a fictional shipment.",
  );
  assert.ok(Number.isFinite(Date.parse(created.createdAt)));

  const listResponse = await fetch(`${baseUrl}/api/v1/quote-requests`);
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), [created]);

  const detailResponse = await fetch(
    `${baseUrl}/api/v1/quote-requests/${created.id}`,
  );
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(await detailResponse.json(), created);
});

test("invalid quote requests are rejected", async () => {
  const invalidRequests = [
    {},
    {
      companyName: "Example Ltd",
      contactName: "Alex Demo",
      email: "not-an-email",
      message: "A request",
    },
    {
      companyName: "Example Ltd",
      contactName: "Alex Demo",
      email: "alex@example.test",
      message: " ",
    },
    {
      companyName: "Example Ltd",
      contactName: "Alex Demo",
      email: "alex@example.test",
      message: "x".repeat(5001),
    },
  ];

  for (const [index, request] of invalidRequests.entries()) {
    const response = await fetch(`${baseUrl}/api/v1/quote-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    assert.equal(
      response.status,
      400,
      `case ${index}: ${await response.clone().text()}`,
    );
  }
});

test("quote requests persist when the local API restarts", async () => {
  const response = await fetch(`${baseUrl}/api/v1/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "Restart Demo Ltd",
      contactName: "Taylor Demo",
      email: "taylor@example.test",
      message: "Persistence check",
    }),
  });
  const created = (await response.json()) as { id: string };

  await application.close();
  await startApplication();

  const readResponse = await fetch(
    `${baseUrl}/api/v1/quote-requests/${created.id}`,
  );
  assert.equal(readResponse.status, 200);
  assert.equal((await readResponse.json()).id, created.id);
});

test("unknown quote request IDs return not found", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/quote-requests/unknown-request`,
  );

  assert.equal(response.status, 404);
});
