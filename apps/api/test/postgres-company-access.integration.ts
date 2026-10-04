import "reflect-metadata";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import type { PoolClient } from "pg";
import { after, test } from "node:test";
import { resolve } from "node:path";
import { POSTGRES_POOL } from "../src/database/postgres-database.service";
import type {
  PostgresClient,
  PostgresPool,
  PostgresQueryResult,
} from "../src/database/postgres-database.service";
import { SupabaseAuthVerifier } from "../src/auth/supabase-auth-verifier";

const identities = new Map([
  ["pg-customer-a", "60000000-0000-4000-8000-000000000001"],
  ["pg-customer-b", "60000000-0000-4000-8000-000000000002"],
  ["pg-department", "60000000-0000-4000-8000-000000000003"],
  ["pg-unassigned", "60000000-0000-4000-8000-000000000004"],
]);

let application: INestApplication | undefined;
let pool: Pool | undefined;
let client: PoolClient | undefined;
let transactionOpen = false;

after(async () => {
  await application?.close();
  if (client && transactionOpen) await client.query("ROLLBACK");
  client?.release();
  await pool?.end();
});

test(
  "live Nest API enforces customer isolation and department read policy with PostgreSQL",
  { skip: process.env.BJH_POSTGRES_ACCESS_TEST !== "1" },
  async () => {
    const connectionString = getLocalDatabaseUrl();
    const databaseUrl = new URL(connectionString);
    assert.ok(
      ["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname),
      "integration test refuses non-local database hosts",
    );
    assert.equal(databaseUrl.port, "54322", "expected local Supabase port");

    pool = new Pool({ connectionString, ssl: false, max: 1 });
    client = await pool.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    await seedFixtures(client);

    const scopedClient: PostgresClient = {
      async query(queryText, values) {
        return (await client!.query(queryText, values)) as PostgresQueryResult;
      },
      release() {},
    };
    const postgresPool: PostgresPool = {
      query: scopedClient.query.bind(scopedClient),
      async connect() {
        return scopedClient;
      },
      async end() {},
    };

    process.env.DATABASE_URL = connectionString;
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(POSTGRES_POOL)
      .useValue(postgresPool)
      .overrideProvider(SupabaseAuthVerifier)
      .useValue({
        async verify(token: string) {
          const userId = identities.get(token);
          assert.ok(userId, "unexpected test token");
          return { userId, email: `${token}@example.test` };
        },
      })
      .compile();

    application = module.createNestApplication({ logger: false });
    await application.init();
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address() as {
      port: number;
    };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const customerA = (path: string) =>
      fetch(`${baseUrl}${path}`, {
        headers: { authorization: "Bearer pg-customer-a" },
      });
    const ownCompanies = await customerA("/api/v1/customers");
    assert.equal(ownCompanies.status, 200);
    assert.deepEqual(
      ((await ownCompanies.json()) as Array<{ id: string }>).map(
        (company) => company.id,
      ),
      ["60000000-0000-4000-8000-000000000101"],
    );

    const guessedCompany = await customerA(
      "/api/v1/customers/60000000-0000-4000-8000-000000000102",
    );
    assert.equal(guessedCompany.status, 404);

    const spoofedSearch = await customerA("/api/v1/customers?search=Southwind");
    assert.deepEqual(await spoofedSearch.json(), []);

    const ownRequests = await customerA("/api/v1/quote-requests");
    assert.equal(ownRequests.status, 200);
    assert.deepEqual(
      ((await ownRequests.json()) as Array<{ id: string }>).map(
        (request) => request.id,
      ),
      ["60000000-0000-4000-8000-000000000201"],
    );

    const otherRequest = await customerA(
      "/api/v1/quote-requests/60000000-0000-4000-8000-000000000202",
    );
    assert.equal(otherRequest.status, 404);

    const parameterSpoof = await customerA(
      "/api/v1/quote-requests?customerCompanyId=60000000-0000-4000-8000-000000000102",
    );
    assert.deepEqual(await parameterSpoof.json(), []);

    const departmentCompanies = await fetch(`${baseUrl}/api/v1/customers`, {
      headers: { authorization: "Bearer pg-department" },
    });
    assert.equal(departmentCompanies.status, 200);
    assert.equal(((await departmentCompanies.json()) as unknown[]).length, 2);

    const departmentRequests = await fetch(`${baseUrl}/api/v1/quote-requests`, {
      headers: { authorization: "Bearer pg-department" },
    });
    assert.equal(departmentRequests.status, 200);
    assert.equal(((await departmentRequests.json()) as unknown[]).length, 2);

    const departmentLink = await fetch(
      `${baseUrl}/api/v1/quote-requests/60000000-0000-4000-8000-000000000201/customer`,
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer pg-department",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          customerCompanyId: "60000000-0000-4000-8000-000000000101",
        }),
      },
    );
    assert.equal(departmentLink.status, 403);

    const unassigned = await fetch(`${baseUrl}/api/v1/customers`, {
      headers: { authorization: "Bearer pg-unassigned" },
    });
    assert.equal(unassigned.status, 403);
  },
);

async function seedFixtures(client: PoolClient): Promise<void> {
  for (const userId of identities.values()) {
    await client.query(
      `INSERT INTO auth.users (id, aud, role, email, encrypted_password)
       VALUES ($1::uuid, 'authenticated', 'authenticated', $2, '')`,
      [userId, `${userId}@example.test`],
    );
  }

  await client.query(
    `INSERT INTO app.customer_company (company_id, company_name)
     VALUES
       ('60000000-0000-4000-8000-000000000101', 'Northstar Synthetic Ltd'),
       ('60000000-0000-4000-8000-000000000102', 'Southwind Synthetic Ltd')`,
  );
  await client.query(
    `INSERT INTO app.customer_contact (company_id, contact_name, email)
     VALUES
       ('60000000-0000-4000-8000-000000000101', 'Northstar Contact', 'northstar@example.test'),
       ('60000000-0000-4000-8000-000000000102', 'Southwind Contact', 'southwind@example.test')`,
  );
  await client.query(
    `INSERT INTO app.quote_request
       (request_id, company_name, contact_name, email, message, customer_company_id)
     VALUES
       ('60000000-0000-4000-8000-000000000201', 'Northstar Synthetic Ltd', 'Northstar Contact', 'northstar@example.test', 'Synthetic request A', '60000000-0000-4000-8000-000000000101'),
       ('60000000-0000-4000-8000-000000000202', 'Southwind Synthetic Ltd', 'Southwind Contact', 'southwind@example.test', 'Synthetic request B', '60000000-0000-4000-8000-000000000102')`,
  );
  await client.query(
    `INSERT INTO app.customer_membership (company_id, user_id, granted_by)
     VALUES
       ('60000000-0000-4000-8000-000000000101', '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000004'),
       ('60000000-0000-4000-8000-000000000102', '60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004')`,
  );
  await client.query(
    `INSERT INTO app.staff_role_assignment (user_id, role_key, assigned_by)
     VALUES ('60000000-0000-4000-8000-000000000003', 'air_import_rep', '60000000-0000-4000-8000-000000000004')`,
  );
}

function getLocalDatabaseUrl(): string {
  const output = execFileSync(
    "corepack",
    ["pnpm", "exec", "supabase", "status", "--output", "env"],
    { cwd: resolve(__dirname, "../.."), encoding: "utf8" },
  );
  const value = output
    .split(/\r?\n/)
    .find((line) => /^(?:export\s+)?DB_URL=/.test(line))
    ?.replace(/^(?:export\s+)?DB_URL=/, "")
    .trim();
  assert.ok(value, "Supabase CLI did not report its local database URL");
  return value.startsWith('"')
    ? (JSON.parse(value) as string)
    : value.replace(/^'/, "").replace(/'$/, "");
}
