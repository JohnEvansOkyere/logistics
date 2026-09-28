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

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "bjh-logistics-api-"));
  process.env.DATABASE_PATH = join(temporaryDirectory, "fresh.sqlite");
  delete process.env.DATABASE_URL;
  const { AppModule } = await import("../src/app.module");
  application = await NestFactory.create(AppModule, { logger: false });
  await application.listen(0, "127.0.0.1");
  const address = application.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
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

test("API health reports the version applied to a freshly created SQLite database", async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    database: {
      status: "ok",
      provider: "sqlite",
      schemaVersion: "002_quote_requests.sql",
    },
  });
});
