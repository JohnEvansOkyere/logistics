import "reflect-metadata";
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { POSTGRES_POOL } from "../src/database/postgres-database.service";
import {
  beginTestDatabase,
  endTestDatabase,
  testPostgresPool,
} from "./postgres-test-database";

let baseUrl: string;
let application: INestApplication;

before(async () => {
  await beginTestDatabase();
  const { AppModule } = await import("../src/app.module");
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(POSTGRES_POOL)
    .useValue(testPostgresPool)
    .compile();
  application = module.createNestApplication({ logger: false });
  await application.listen(0, "127.0.0.1");
  const address = application.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await application?.close();
  await endTestDatabase();
});

test("API health reports a healthy local PostgreSQL database", async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    database: {
      status: "ok",
      provider: "postgresql",
    },
  });
});
