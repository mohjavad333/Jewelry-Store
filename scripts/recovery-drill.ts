import "dotenv/config";
import { assertBackupObjectKey } from "./backup-storage";

if (process.env.CONFIRM_RECOVERY_DRILL !== "YES") {
  throw new Error("Recovery drill is destructive. Set CONFIRM_RECOVERY_DRILL=YES to continue.");
}
if (process.env.CONFIRM_RESTORE !== "YES") {
  throw new Error("Set CONFIRM_RESTORE=YES before running a recovery drill.");
}
if (process.env.CONFIRM_RECOVERY_TEST !== "YES") {
  throw new Error("Set CONFIRM_RECOVERY_TEST=YES before running a recovery drill.");
}
const backupKey = process.env.BACKUP_OBJECT_KEY?.trim();
if (!backupKey) throw new Error("BACKUP_OBJECT_KEY is required; recovery drills must restore from independent storage.");
assertBackupObjectKey(backupKey);

const drillStartedAt = Date.now();
const restore = await import("./restore-db.ts");
await import("./test-recovery.ts");
if (!restore.restoreResult) throw new Error("Restore did not report a completed recovery result.");
const backupAgeHours = (Date.now() - Date.parse(restore.restoreResult.backupCreatedAt)) / (60 * 60 * 1000);
const recoverySeconds = (Date.now() - drillStartedAt) / 1000;
console.log(`Offsite recovery drill passed. RPO: ${backupAgeHours.toFixed(2)} hours; RTO: ${recoverySeconds.toFixed(1)} seconds; restore: ${restore.restoreResult.restoreSeconds.toFixed(1)} seconds.`);
