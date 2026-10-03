import "dotenv/config";
import { Pool } from "pg";
import path from "node:path";
import { spawn } from "node:child_process";
import { assertBackupObjectKey } from "./backup-storage";
import { downloadRemoteBackup, readLocalBackupManifest } from "./remote-backup";
import { assertDifferentDatabaseInstances, assertEmptyRecoveryTarget, assertIsolatedRecoveryEndpoint, readRecoveryDatabaseIdentity } from "./recovery-target";

const backupPath = process.env.BACKUP_FILE?.trim();
const backupKey = process.env.BACKUP_OBJECT_KEY?.trim();
const restoreDatabaseUrl = process.env.RESTORE_DATABASE_URL?.trim();
const sourceDatabaseUrl = process.env.DATABASE_URL?.trim();
const expectedDatabase = process.env.RESTORE_DATABASE_NAME?.trim();

if (!backupPath && !backupKey) throw new Error("BACKUP_OBJECT_KEY is required for a recovery drill; BACKUP_FILE is allowed only for an explicitly confirmed local restore.");
if (backupPath && backupKey) throw new Error("Set either BACKUP_OBJECT_KEY or BACKUP_FILE, not both.");
if (backupKey) assertBackupObjectKey(backupKey);
if (!expectedDatabase) throw new Error("RESTORE_DATABASE_NAME is required to identify the recovery database.");
assertIsolatedRecoveryEndpoint(sourceDatabaseUrl, restoreDatabaseUrl, expectedDatabase);
if (process.env.CONFIRM_RESTORE !== "YES") throw new Error("Restore is destructive. Set CONFIRM_RESTORE=YES to continue.");

const sourcePool = new Pool({ connectionString: sourceDatabaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
const targetPool = new Pool({ connectionString: restoreDatabaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
let downloaded: Awaited<ReturnType<typeof downloadRemoteBackup>> | undefined;
export let restoreResult: { database: string; backupCreatedAt: string; restoreSeconds: number } | undefined;
try {
  const sourceIdentity = await readRecoveryDatabaseIdentity(sourcePool);
  const targetIdentity = await readRecoveryDatabaseIdentity(targetPool, expectedDatabase);
  assertDifferentDatabaseInstances(sourceIdentity, targetIdentity);
  await assertEmptyRecoveryTarget(targetPool);

  let resolvedBackupPath: string;
  if (backupKey) {
    downloaded = await downloadRemoteBackup(backupKey);
    resolvedBackupPath = downloaded.backupPath;
  } else {
    resolvedBackupPath = path.resolve(backupPath!);
    await readLocalBackupManifest(resolvedBackupPath);
  }

  const manifest = downloaded?.manifest ?? await readLocalBackupManifest(resolvedBackupPath);
  const startedAt = Date.now();
  await new Promise<void>((resolve, reject) => {
    const restore = spawn("pg_restore", [
      "--clean",
      "--if-exists",
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      restoreDatabaseUrl!,
      resolvedBackupPath,
    ], { stdio: "inherit" });
    restore.once("error", (error) => reject(new Error(`pg_restore could not start. Install PostgreSQL client tools first. ${error.message}`)));
    restore.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`pg_restore exited with code ${code ?? "unknown"}.`)));
  });
  const restoreSeconds = (Date.now() - startedAt) / 1000;
  restoreResult = { database: targetIdentity.database, backupCreatedAt: manifest.createdAt, restoreSeconds };
  console.log(`Database restored into isolated target ${targetIdentity.database} in ${restoreSeconds.toFixed(1)} seconds.`);
} finally {
  await downloaded?.cleanup();
  await Promise.all([sourcePool.end(), targetPool.end()]);
}
