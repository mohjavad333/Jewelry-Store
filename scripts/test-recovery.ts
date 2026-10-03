import "dotenv/config";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { assertDifferentDatabaseInstances, assertIsolatedRecoveryEndpoint, assertRecoveryTargetMarker, readRecoveryDatabaseIdentity } from "./recovery-target";

const targetDatabaseUrl = process.env.RESTORE_DATABASE_URL?.trim();
const expectedDatabase = process.env.RESTORE_DATABASE_NAME?.trim();
const sourceDatabaseUrl = process.env.DATABASE_URL?.trim();
assertIsolatedRecoveryEndpoint(sourceDatabaseUrl, targetDatabaseUrl, expectedDatabase);
if (process.env.CONFIRM_RECOVERY_TEST !== "YES") throw new Error("Set CONFIRM_RECOVERY_TEST=YES to test the restored database.");

const pool = new Pool({ connectionString: targetDatabaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
const migrationsDir = path.resolve(process.cwd(), "database/migrations");
let recoveryDatabase = "";
try {
  const sourcePool = new Pool({ connectionString: sourceDatabaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    const sourceIdentity = await readRecoveryDatabaseIdentity(sourcePool);
    const targetIdentity = await readRecoveryDatabaseIdentity(pool, expectedDatabase);
    recoveryDatabase = targetIdentity.database;
    assertDifferentDatabaseInstances(sourceIdentity, targetIdentity);
  } finally {
    await sourcePool.end();
  }

  await assertRecoveryTargetMarker(pool);
  const requiredTables = ["schema_migrations", "users", "products", "addresses", "sessions", "auth_challenges", "orders", "order_items", "notifications", "admin_users", "admin_sessions", "admin_activity_logs"];
  const missingTables: string[] = [];
  for (const table of requiredTables) {
    const result = await pool.query<{ name: string | null }>("SELECT to_regclass($1) AS name", [`public.${table}`]);
    if (!result.rows[0]?.name) missingTables.push(table);
  }
  if (missingTables.length) throw new Error(`Recovery database is missing required tables: ${missingTables.join(", ")}.`);

  const expectedMigrations = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const appliedResult = await pool.query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name");
  const appliedMigrations = new Set(appliedResult.rows.map((row) => row.name));
  const missingMigrations = expectedMigrations.filter((name) => !appliedMigrations.has(name));
  if (missingMigrations.length) throw new Error(`Recovery database is missing migrations: ${missingMigrations.join(", ")}.`);

  const [products, users, orders, notifications, orphanedItems] = await Promise.all([
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM products WHERE active = TRUE"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM orders"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM notifications"),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM order_items i LEFT JOIN orders o ON o.id = i.order_id WHERE o.id IS NULL"),
  ]);
  if (Number(products.rows[0]?.count) < 1) throw new Error("Recovery database has no active products; expected baseline data is missing.");
  if (Number(orphanedItems.rows[0]?.count) !== 0) throw new Error("Recovery database contains order items without a matching order.");

  const sample = await pool.query("SELECT id, name, price, stock FROM products WHERE active = TRUE ORDER BY id LIMIT 1");
  if (!sample.rows[0]) throw new Error("Recovery database failed the application product-read check.");
  console.log(`Recovery validation passed for ${recoveryDatabase}: ${expectedMigrations.length} migrations, ${products.rows[0].count} active products, ${users.rows[0].count} users, ${orders.rows[0].count} orders, ${notifications.rows[0].count} notifications.`);
} finally {
  await pool.end();
}
