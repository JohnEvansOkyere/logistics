import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

const migrationTable = "local_schema_migrations";

export function runSqliteMigrations(
  connection: Database.Database,
  migrationsDirectory: string,
): void {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS ${migrationTable} (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    (
      connection
        .prepare(`SELECT version FROM ${migrationTable}`)
        .all() as Array<{ version: string }>
    ).map(({ version }) => version),
  );
  const migrations = readdirSync(migrationsDirectory)
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
    .sort();

  for (const version of migrations) {
    if (applied.has(version)) {
      continue;
    }

    const sql = readFileSync(join(migrationsDirectory, version), "utf8");
    connection.transaction(() => {
      connection.exec(sql);
      connection
        .prepare(
          `INSERT INTO ${migrationTable} (version, applied_at) VALUES (?, ?)`,
        )
        .run(version, new Date().toISOString());
    })();
  }
}
