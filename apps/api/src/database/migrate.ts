import "reflect-metadata";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { runSqliteMigrations } from "./sqlite-migrations";

const configuredPath =
  process.env.DATABASE_PATH ?? "../../.local/logistics.sqlite";
const databasePath = isAbsolute(configuredPath)
  ? configuredPath
  : resolve(process.cwd(), configuredPath);
mkdirSync(dirname(databasePath), { recursive: true });

const connection = new Database(databasePath);
try {
  runSqliteMigrations(connection, resolve(__dirname, "migrations"));
  process.stdout.write(
    `Local SQLite migrations are up to date: ${databasePath}\n`,
  );
} finally {
  connection.close();
}
