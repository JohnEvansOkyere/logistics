import { Logger, Module } from "@nestjs/common";
import type { Provider } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { Pool } from "pg";
import { DatabasePort } from "./database.port";
import {
  POSTGRES_POOL,
  PostgresDatabaseService,
} from "./postgres-database.service";
import { SqliteDatabaseService } from "./sqlite-database.service";

function createPostgresPool(connectionString: string): Pool {
  const logger = new Logger("PostgresPool");
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres or postgresql scheme");
  }

  const configuredCaPath =
    process.env.DATABASE_SSL_CA_PATH ?? "../../.local/supabase-root.crt";
  const caPath = isAbsolute(configuredCaPath)
    ? configuredCaPath
    : resolve(process.cwd(), configuredCaPath);
  let ca: string | undefined;
  try {
    ca = readFileSync(caPath, "utf8");
  } catch {
    logger.error(
      "Supabase root certificate unavailable; PostgreSQL health probes will rely on system CAs",
    );
  }

  // TLS settings are provided explicitly so pg verifies the server certificate.
  for (const sslParameter of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) {
    url.searchParams.delete(sslParameter);
  }
  const pool = new Pool({
    connectionString: url.toString(),
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: "bjh-logistics-api",
  });

  pool.on("error", (error) => {
    const errorCode =
      "code" in error && typeof error.code === "string"
        ? ` (${error.code})`
        : "";
    logger.error(`Idle PostgreSQL connection failed${errorCode}`);
  });

  return pool;
}

const connectionString = process.env.DATABASE_URL?.trim();
const selectedDatabase = connectionString
  ? PostgresDatabaseService
  : SqliteDatabaseService;

const providers: Provider[] = connectionString
  ? [
      {
        provide: POSTGRES_POOL,
        useFactory: () => createPostgresPool(connectionString),
      },
      PostgresDatabaseService,
    ]
  : [SqliteDatabaseService];

@Module({
  providers: [
    ...providers,
    {
      provide: DatabasePort,
      useExisting: selectedDatabase,
    },
  ],
  exports: [DatabasePort],
})
export class DatabaseModule {}
