import { spawn, spawnSync } from "node:child_process";

const cli = ["pnpm", "exec", "supabase"];
const mode = process.argv[2];
const telemetryEnv = { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: telemetryEnv,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture) {
      const diagnostic = `${result.stderr ?? ""}\n${result.stdout ?? ""}`
        .split(/\r?\n/)
        .filter(
          (line) =>
            /error|failed|denied|docker|daemon|permission|unable/i.test(line) &&
            !/key|token|secret|password|anon/i.test(line),
        )
        .join("\n");
      if (diagnostic) process.stderr.write(`${diagnostic}\n`);
    }
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? "";
}

function localSettings() {
  const output = run("corepack", [...cli, "status", "--output", "env"], {
    capture: true,
  });
  const settings = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    const value = rawValue.trim();
    settings[name] = value.startsWith('"')
      ? JSON.parse(value)
      : value.replace(/^'/, "").replace(/'$/, "");
  }
  for (const name of ["API_URL", "DB_URL", "ANON_KEY"]) {
    if (!settings[name])
      throw new Error("Supabase status omitted local connection settings");
  }
  return settings;
}

function runLocalApps(settings) {
  if (!settings.SERVICE_ROLE_KEY) {
    throw new Error("Supabase status omitted the local service-role key");
  }
  const webSafeEnv = { ...process.env };
  delete webSafeEnv.SUPABASE_SERVICE_ROLE_KEY;
  delete webSafeEnv.SUPABASE_SECRET_KEY;
  delete webSafeEnv.SERVICE_ROLE_KEY;
  const sharedEnv = {
    ...webSafeEnv,
    WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://127.0.0.1:3002",
    NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.ANON_KEY,
    SUPABASE_URL: settings.API_URL,
  };
  const children = [
    spawn("corepack", ["pnpm", "--filter", "@bjh/api", "dev"], {
      cwd: process.cwd(),
      env: {
        ...sharedEnv,
        DATABASE_URL: settings.DB_URL,
        SUPABASE_PUBLISHABLE_KEY: settings.ANON_KEY,
        SUPER_ADMIN_BOOTSTRAP_ENABLED: "true",
        SUPABASE_SERVICE_ROLE_KEY: settings.SERVICE_ROLE_KEY,
      },
      stdio: "inherit",
    }),
    spawn("corepack", ["pnpm", "--filter", "@bjh/web", "dev"], {
      cwd: process.cwd(),
      env: sharedEnv,
      stdio: "inherit",
    }),
  ];
  let stopping = false;
  const stopOthers = (source) => {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
      if (child !== source && child.exitCode === null) child.kill("SIGTERM");
    }
  };
  for (const child of children) {
    child.on("error", () => stopOthers(child));
    child.on("exit", (code, signal) => {
      if (!stopping) stopOthers(child);
      process.exitCode = code ?? (signal ? 1 : 0);
    });
  }
  process.on("SIGINT", () => {
    for (const child of children) child.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    for (const child of children) child.kill("SIGTERM");
  });
}

function prepare() {
  const status = spawnSync("corepack", [...cli, "status", "--output", "env"], {
    cwd: process.cwd(),
    env: telemetryEnv,
    stdio: "ignore",
  });
  if (status.status !== 0) {
    run("corepack", [...cli, "start"], { capture: true });
  }
  run("corepack", [...cli, "db", "push", "--local"]);
  return localSettings();
}

if (mode === "prepare") {
  prepare();
  process.stdout.write(
    "Local Supabase is ready; existing local data was preserved.\n",
  );
} else if (mode === "dev") {
  const settings = prepare();
  runLocalApps(settings);
} else if (mode === "web") {
  const settings = prepare();
  const webSafeEnv = { ...process.env };
  delete webSafeEnv.SUPABASE_SERVICE_ROLE_KEY;
  delete webSafeEnv.SUPABASE_SECRET_KEY;
  delete webSafeEnv.SERVICE_ROLE_KEY;
  const appEnv = {
    ...webSafeEnv,
    NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.ANON_KEY,
    SUPABASE_URL: settings.API_URL,
  };
  const result = spawnSync(
    "corepack",
    ["pnpm", "--filter", "@bjh/web", "dev"],
    { cwd: process.cwd(), env: appEnv, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} else if (mode === "stop") {
  run("corepack", [...cli, "stop"]);
} else {
  process.stderr.write(
    "Usage: node scripts/supabase-local.mjs <prepare|dev|web|stop>\n",
  );
  process.exit(2);
}
