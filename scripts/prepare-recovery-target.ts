import "dotenv/config";
import { Pool } from "pg";
import { assertDifferentDatabaseInstances, assertIsolatedRecoveryEndpoint, readRecoveryDatabaseIdentity } from "./recovery-target";

if (process.env.CONFIRM_PREPARE_RECOVERY_TARGET !== "YES") {
  throw new Error("Preparing a recovery target writes a marker table. Set CONFIRM_PREPARE_RECOVERY_TARGET=YES to continue.");
}

const sourceUrl = process.env.DATABASE_URL?.trim();
const targetUrl = process.env.RESTORE_DATABASE_URL?.trim();
const expectedDatabase = process.env.RESTORE_DATABASE_NAME?.trim();
assertIsolatedRecoveryEndpoint(sourceUrl, targetUrl, expectedDatabase);

const source = new Pool({ connectionString: sourceUrl, max: 1, connectionTimeoutMillis: 10_000 });
const target = new Pool({ connectionString: targetUrl, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const sourceIdentity = await readRecoveryDatabaseIdentity(source);
  const targetIdentity = await readRecoveryDatabaseIdentity(target, expectedDatabase);
  assertDifferentDatabaseInstances(sourceIdentity, targetIdentity);

  const client = await target.connect();
  try {
    await client.query("BEGIN");
    const tables = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')");
    if (tables.rows[0]?.count !== "0") {
      throw new Error("Recovery target must be a newly created empty database with no public tables.");
    }

    await client.query("CREATE SCHEMA zarinsa_recovery_control");
    await client.query(`
      CREATE TABLE zarinsa_recovery_control.target (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        purpose TEXT NOT NULL CHECK (purpose = 'recovery'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query("INSERT INTO zarinsa_recovery_control.target (id, purpose) VALUES (1, 'recovery')");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  console.log(`Prepared empty recovery target ${targetIdentity.database}; endpoint verified as separate from the source.`);
} finally {
  await Promise.all([source.end(), target.end()]);
}
