import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { PoolClient } from "pg";
import type {
  PostgresClient,
  PostgresPool,
  PostgresQueryResult,
} from "../src/database/postgres-database.service";

/**
 * Test database on the LOCAL Supabase PostgreSQL. Each test file runs inside one
 * outer transaction that empties the app tables first and is rolled back at the
 * end, so local development data is never modified. The API's own
 * BEGIN/COMMIT/ROLLBACK calls are mapped to savepoints and its connections are
 * serialized onto the single test connection.
 */
export const TEST_AUTH_USER_IDS = [
  "50000000-0000-4000-8000-000000000001",
  "50000000-0000-4000-8000-000000000002",
  "50000000-0000-4000-8000-000000000003",
  "50000000-0000-4000-8000-000000000004",
  "50000000-0000-4000-8000-000000000005",
  "50000000-0000-4000-8000-000000000006",
];

let pool: Pool | undefined;
let client: PoolClient | undefined;
let lock: Promise<void> = Promise.resolve();
let savepointCounter = 0;
const savepointStack: string[] = [];
const originalDatabaseUrl = process.env.DATABASE_URL;

export function getLocalDatabaseUrl(): string {
  const output = execFileSync(
    "corepack",
    ["pnpm", "exec", "supabase", "status", "--output", "env"],
    { cwd: resolve(__dirname, "../../.."), encoding: "utf8" },
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

async function runOnTestConnection(
  queryText: string,
  values?: unknown[],
): Promise<PostgresQueryResult> {
  assert.ok(client, "beginTestDatabase() has not been called");
  const statement = queryText.trim().toUpperCase();
  if (statement === "BEGIN") {
    const name = `test_sp_${++savepointCounter}`;
    savepointStack.push(name);
    return (await client.query(`SAVEPOINT ${name}`)) as PostgresQueryResult;
  }
  if (statement === "COMMIT") {
    const name = savepointStack.pop();
    return (await client.query(
      `RELEASE SAVEPOINT ${name}`,
    )) as PostgresQueryResult;
  }
  if (statement === "ROLLBACK") {
    const name = savepointStack.pop();
    if (!name) return { rows: [], rowCount: 0 } as PostgresQueryResult;
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    return (await client.query(
      `RELEASE SAVEPOINT ${name}`,
    )) as PostgresQueryResult;
  }
  if (savepointStack.length > 0) {
    return (await client.query(queryText, values)) as PostgresQueryResult;
  }
  // Outside an API-managed transaction a real connection would autocommit, so
  // a failed statement must not poison the shared outer transaction.
  const name = `test_sp_${++savepointCounter}`;
  await client.query(`SAVEPOINT ${name}`);
  try {
    const result = (await client.query(
      queryText,
      values,
    )) as PostgresQueryResult;
    await client.query(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    await client.query(`RELEASE SAVEPOINT ${name}`);
    throw error;
  }
}

async function acquire(): Promise<() => void> {
  const previous = lock;
  let release!: () => void;
  lock = new Promise<void>((done) => (release = done));
  await previous;
  return release;
}

export const testPostgresPool: PostgresPool = {
  async query(queryText, values) {
    const release = await acquire();
    try {
      return await runOnTestConnection(queryText, values);
    } finally {
      release();
    }
  },
  async connect(): Promise<PostgresClient> {
    const release = await acquire();
    let released = false;
    return {
      query: (queryText, values) => runOnTestConnection(queryText, values),
      release() {
        if (released) return;
        released = true;
        release();
      },
    };
  },
  async end() {},
};

export async function beginTestDatabase(): Promise<void> {
  const connectionString = getLocalDatabaseUrl();
  const databaseUrl = new URL(connectionString);
  assert.ok(
    ["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname),
    "API tests refuse non-local database hosts",
  );
  assert.equal(databaseUrl.port, "54322", "expected local Supabase port");

  process.env.DATABASE_URL = connectionString;
  pool = new Pool({ connectionString, ssl: false, max: 1 });
  client = await pool.connect();
  await client.query("BEGIN");
  const tables = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'app'",
  );
  await client.query(
    `TRUNCATE ${tables.rows.map((row) => `app."${row.tablename}"`).join(", ")} CASCADE`,
  );
  for (const userId of TEST_AUTH_USER_IDS) {
    await client.query(
      `INSERT INTO auth.users (id, aud, role, email, encrypted_password)
       VALUES ($1::uuid, 'authenticated', 'authenticated', $2, '')
       ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@example.test`],
    );
  }
}

export async function endTestDatabase(): Promise<void> {
  if (client) {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
  await pool?.end();
  client = undefined;
  pool = undefined;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
}
