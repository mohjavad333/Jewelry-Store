import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db, closeDatabase } from "../server/db";

const migrationsDir = path.resolve(process.cwd(), "database/migrations");

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const name of files) {
    const existing = await db.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
    if (existing.rowCount) continue;

    const sql = await readFile(path.join(migrationsDir, name), "utf8");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .catch((error) => {
    console.error("Database migration failed.", error);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
