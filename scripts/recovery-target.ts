import { URL } from "node:url";

export type RecoveryDatabaseIdentity = { database: string; serverAddress: string | null; serverPort: number };

export function assertIsolatedRecoveryEndpoint(sourceUrl: string | undefined, targetUrl: string | undefined, expectedDatabase: string | undefined) {
  if (!sourceUrl) throw new Error("DATABASE_URL is required to verify recovery target isolation.");
  if (!targetUrl) throw new Error("RESTORE_DATABASE_URL is required for recovery.");
  if (!expectedDatabase || !/(recovery|drill)/i.test(expectedDatabase)) {
    throw new Error("RESTORE_DATABASE_NAME must explicitly identify a recovery or drill database.");
  }
  const source = new URL(sourceUrl);
  const target = new URL(targetUrl);
  if (source.host.toLowerCase() === target.host.toLowerCase()) {
    throw new Error("Recovery target must use a database endpoint separate from the source.");
  }
}

export async function readRecoveryDatabaseIdentity(pool: { query: (sql: string) => Promise<{ rows: RecoveryDatabaseIdentity[] }> }, expectedDatabase?: string) {
  const result = await pool.query("SELECT current_database() AS database, inet_server_addr()::text AS \"serverAddress\", inet_server_port() AS \"serverPort\"");
  const identity = result.rows[0];
  if (!identity || (expectedDatabase && identity.database !== expectedDatabase)) {
    throw new Error("RESTORE_DATABASE_NAME does not match the connected recovery database.");
  }
  return identity;
}

export function assertDifferentDatabaseInstances(source: RecoveryDatabaseIdentity, target: RecoveryDatabaseIdentity) {
  if (source.serverAddress && source.serverAddress === target.serverAddress && source.serverPort === target.serverPort) {
    throw new Error("Recovery target resolves to the same PostgreSQL server as the source.");
  }
}

export async function assertRecoveryTargetMarker(pool: { query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<{ purpose?: string; count?: string }> }> }) {
  const result = await pool.query("SELECT purpose FROM zarinsa_recovery_control.target WHERE id = 1");
  if (result.rows[0]?.purpose !== "recovery") {
    throw new Error("Recovery database marker is missing or invalid; prepare a dedicated recovery database first.");
  }
}

export async function assertEmptyRecoveryTarget(pool: { query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<{ count?: string }> }> }) {
  await assertRecoveryTargetMarker(pool);
  const tables = await pool.query("SELECT COUNT(*)::text AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN ('information_schema', 'zarinsa_recovery_control') AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')");
  if (tables.rows[0]?.count !== "0") {
    throw new Error("Recovery target is not fresh. Create a new empty recovery database for each drill.");
  }
}
