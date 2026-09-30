// Adds clearly labelled DEMO records to the LOCAL database so the system can be
// tried without typing everything in: two customer companies with contacts, a
// job on each service line, a few milestones, and some warehouse stock.
//
//   corepack pnpm seed:demo
//
// It refuses to run against anything but the local Supabase database, needs a
// super admin to exist (sign up at /sign-in first), and does nothing if the demo
// companies are already there. The contact emails and phone numbers are
// placeholders: change them to your own to see real messages arrive once email
// or SMS credentials are configured (otherwise messages are only recorded).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { Client } = require("pg");

const status = execFileSync(
  "corepack",
  ["pnpm", "exec", "supabase", "status", "--output", "env"],
  {
    encoding: "utf8",
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
  },
);
const setting = (name) => {
  const line = status.split("\n").find((row) => row.startsWith(`${name}=`));
  if (!line)
    throw new Error(
      "Local Supabase is not running (corepack pnpm supabase:start)",
    );
  return line.slice(name.length + 1).replace(/^"|"$/g, "");
};

const url = new URL(setting("DB_URL"));
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
  throw new Error("The demo seed only runs against the local database");
}

const client = new Client({ connectionString: url.toString(), ssl: false });
await client.connect();
try {
  await client.query("BEGIN");
  const admin = await client.query(
    `SELECT user_id FROM app.staff_role_assignment
     WHERE role_key = 'super_admin' AND revoked_at IS NULL LIMIT 1`,
  );
  if (admin.rows.length === 0) {
    throw new Error(
      "No super admin yet: sign up at http://127.0.0.1:3002/sign-in first",
    );
  }
  const adminId = admin.rows[0].user_id;

  // Two demo logins (local only, fixed password): a sea-import rep and a customer.
  const demoUser = async (email) => {
    const found = await client.query(
      "SELECT id FROM auth.users WHERE email = $1",
      [email],
    );
    if (found.rows.length > 0) return found.rows[0].id;
    const response = await fetch(`${setting("API_URL")}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: setting("SERVICE_ROLE_KEY"),
        authorization: `Bearer ${setting("SERVICE_ROLE_KEY")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        password: "demo-password-123",
        email_confirm: true,
      }),
    });
    if (!response.ok)
      throw new Error(`Could not create ${email}: ${response.status}`);
    return (await response.json()).id;
  };
  const repId = await demoUser("demo.rep@example.test");
  const customerId = await demoUser("demo.customer@example.test");
  await client.query(
    `INSERT INTO app.staff_role_assignment (user_id, role_key, assigned_by)
     SELECT $1, 'sea_import_rep', $2
     WHERE NOT EXISTS (SELECT 1 FROM app.staff_role_assignment WHERE user_id = $1 AND revoked_at IS NULL)`,
    [repId, adminId],
  );

  const existing = await client.query(
    "SELECT company_id FROM app.customer_company WHERE company_name = 'DEMO Northstar Trading Ltd'",
  );
  const linkCustomer = (companyId) =>
    client.query(
      `INSERT INTO app.customer_membership (company_id, user_id, granted_by)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM app.customer_membership
         WHERE company_id = $1 AND user_id = $2 AND revoked_at IS NULL)`,
      [companyId, customerId, adminId],
    );
  if (existing.rows.length > 0) {
    await linkCustomer(existing.rows[0].company_id);
    await client.query("COMMIT");
    console.log("Demo records already exist; the demo logins were checked.");
    process.exit(0);
  }

  const company = async (name, contacts) => {
    const inserted = await client.query(
      "INSERT INTO app.customer_company (company_name) VALUES ($1) RETURNING company_id",
      [name],
    );
    const id = inserted.rows[0].company_id;
    for (const [contact, email, phone] of contacts) {
      await client.query(
        `INSERT INTO app.customer_contact (company_id, contact_name, email, phone)
         VALUES ($1, $2, $3, $4)`,
        [id, contact, email, phone],
      );
    }
    return id;
  };
  const northstar = await company("DEMO Northstar Trading Ltd", [
    ["Ama Mensah", "ama.mensah@example.test", "0240000001"],
    ["Kojo Boateng", "kojo.boateng@example.test", null],
  ]);
  await linkCustomer(northstar);
  const southwind = await company("DEMO Southwind Foods Ltd", [
    ["Yaw Owusu", "yaw.owusu@example.test", "0500000002"],
  ]);

  const year = new Date().getUTCFullYear();
  const job = async (companyId, serviceLine) => {
    const number = await client.query(
      "SELECT app.allocate_job_number($1, $2) AS n",
      [serviceLine, year],
    );
    const inserted = await client.query(
      `INSERT INTO app.job (file_number, service_line, customer_company_id, opened_by)
       VALUES ($1, $2, $3, $4) RETURNING job_id`,
      [number.rows[0].n, serviceLine, companyId, adminId],
    );
    return inserted.rows[0].job_id;
  };
  const hoursAgo = (hours) =>
    new Date(Date.now() - hours * 3_600_000).toISOString();

  const seaImport = await job(northstar, "sea_import");
  await client.query(
    `INSERT INTO app.job_party (job_id, role, party_name, details, created_by) VALUES
       ($1, 'shipper', 'Demo Overseas Supplier GmbH', 'Hamburg, Germany', $2),
       ($1, 'consignee', 'DEMO Northstar Trading Ltd', 'Tema, Ghana', $2)`,
    [seaImport, adminId],
  );
  await client.query(
    `INSERT INTO app.shipment_reference (job_id, kind, reference_value, created_by) VALUES
       ($1, 'booking', 'DEMOBK0001', $2)`,
    [seaImport, adminId],
  );
  const container = await client.query(
    `INSERT INTO app.shipment_reference (job_id, kind, reference_value, seal_number, created_by)
     VALUES ($1, 'container', 'DEMU1234567', 'DSEAL01', $2) RETURNING reference_id`,
    [seaImport, adminId],
  );
  void container;
  await client.query(
    `INSERT INTO app.milestone_event (job_id, milestone_key, occurred_at, recorded_by)
     VALUES ($1, 'cargo_arrived', $2, $3)`,
    [seaImport, hoursAgo(30), adminId],
  );
  await client.query(
    `INSERT INTO app.eta_event (job_id, eta_at, source, recorded_by)
     VALUES ($1, $2, 'demo shipping line notice', $3)`,
    [seaImport, new Date(Date.now() + 48 * 3_600_000).toISOString(), adminId],
  );

  const airExport = await job(southwind, "air_export");
  await client.query(
    `INSERT INTO app.job_party (job_id, role, party_name, created_by) VALUES
       ($1, 'shipper', 'DEMO Southwind Foods Ltd', $2),
       ($1, 'consignee', 'Demo Importer LLC', $2)`,
    [airExport, adminId],
  );

  const road = await job(northstar, "road_transport");
  const warehouse = await job(southwind, "warehousing");
  const location = await client.query(
    `INSERT INTO app.warehouse_location (location_name, created_by)
     VALUES ('DEMO Bay A1', $1) RETURNING location_id`,
    [adminId],
  );
  const bay = location.rows[0].location_id;
  await client.query(
    `INSERT INTO app.stock_movement (job_id, location_id, kind, item, unit, quantity, condition_notes, occurred_at, recorded_by)
     VALUES ($1, $2, 'receipt', 'Cartons of canned tomatoes', 'cartons', 200, '2 cartons dented on arrival', $3, $4),
            ($1, $2, 'release', 'Cartons of canned tomatoes', 'cartons', 60, NULL, $5, $4)`,
    [warehouse, bay, hoursAgo(72), adminId, hoursAgo(24)],
  );
  void road;

  await client.query("COMMIT");
  console.log(
    "Demo records added: 2 companies, 4 jobs (sea import, air export, road, warehousing).",
  );
  console.log(
    "Change the demo contacts' emails and phone numbers to your own to try real messages.",
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
