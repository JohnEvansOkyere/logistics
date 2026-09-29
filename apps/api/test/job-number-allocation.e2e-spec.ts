import assert from "node:assert/strict";
import { after, test } from "node:test";
import { Pool } from "pg";
import { getLocalDatabaseUrl } from "./postgres-test-database";

// Uses a far-future year on the local database and removes its rows afterwards.
const TEST_YEAR = 2098;
const pool = new Pool({
  connectionString: getLocalDatabaseUrl(),
  ssl: false,
  max: 12,
});

after(async () => {
  await pool.query(
    "DELETE FROM app.job_number_sequence WHERE sequence_year = $1",
    [TEST_YEAR],
  );
  await pool.end();
});

test("concurrent job number allocation yields unique, gap-free numbers", async () => {
  const allocations = await Promise.all(
    Array.from({ length: 40 }, async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<{ number: string }>(
          "SELECT app.allocate_job_number('sea_export', $1) AS number",
          [TEST_YEAR],
        );
        await client.query("COMMIT");
        return result.rows[0].number;
      } finally {
        client.release();
      }
    }),
  );

  assert.equal(new Set(allocations).size, 40);
  assert.deepEqual(
    [...allocations].sort(),
    Array.from(
      { length: 40 },
      (_, index) => `BJH/SE/${TEST_YEAR}/${String(index + 1).padStart(4, "0")}`,
    ),
  );
});
