import "dotenv/config";
import "dotenv/config";
import { mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";

const backupDirectory = path.resolve(process.env.BACKUP_DIR ?? "backups");
const lockPath = path.join(backupDirectory, ".backup-job.lock");
const alertUrl = process.env.BACKUP_ALERT_WEBHOOK_URL?.trim();
const alertToken = process.env.BACKUP_ALERT_AUTH_TOKEN?.trim();

async function notifyFailure() {
  if (!alertUrl) return;
  try {
    const response = await fetch(alertUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(alertToken ? { Authorization: `Bearer ${alertToken}` } : {}),
      },
      body: JSON.stringify({
        service: "zarinsa",
        event: "database_backup_failure",
        occurredAt: new Date().toISOString(),
        message: "Scheduled database backup job failed.",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) console.error(`Backup failure alert returned HTTP ${response.status}.`);
  } catch (error) {
    console.error("Backup failure alert could not be delivered.", error);
  }
}

await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
let lock;
try {
  lock = await open(lockPath, "wx", 0o600);
} catch (error) {
  if ((error as { code?: string }).code === "EEXIST") {
    throw new Error(`Another backup job is already running: ${lockPath}`);
  }
  throw error;
}

try {
  try {
    await import("./backup-db.ts");
    await import("./check-backup.ts");
    await import("./upload-backup.ts");
    console.log("Scheduled database backup job completed successfully.");
  } catch (error) {
    await notifyFailure();
    throw error;
  }
} finally {
  await lock.close();
  await unlink(lockPath).catch(() => undefined);
}
