import "dotenv/config";
import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const backupDirectory = path.resolve(process.env.BACKUP_DIR ?? "backups");
const configuredBackup = process.env.BACKUP_FILE;
const maxAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS ?? 26);
if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
  throw new Error("BACKUP_MAX_AGE_HOURS must be a positive number.");
}

async function findBackup() {
  if (configuredBackup) return path.resolve(configuredBackup);
  const files = (await readdir(backupDirectory))
    .filter((name) => /^zarinsa-\d{8}T\d{6}(?:\d{3})?Z\.dump$/.test(name));
  const candidates = await Promise.all(files.map(async (name) => {
    const filePath = path.join(backupDirectory, name);
    return { filePath, modifiedAt: (await stat(filePath)).mtimeMs };
  }));
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
  return candidates[0]?.filePath;
}

const backupPath = await findBackup();
if (!backupPath) throw new Error("No database backup was found.");

const manifestPath = `${backupPath}.sha256.json`;
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { backup?: unknown; sha256?: unknown; createdAt?: unknown };
if (manifest.backup !== path.basename(backupPath) || typeof manifest.sha256 !== "string" || typeof manifest.createdAt !== "string") {
  throw new Error(`Backup integrity manifest is invalid: ${manifestPath}`);
}

const createdAt = Date.parse(manifest.createdAt);
if (!Number.isFinite(createdAt)) throw new Error(`Backup manifest has an invalid creation time: ${manifestPath}`);
const ageHours = (Date.now() - createdAt) / (60 * 60 * 1000);
if (ageHours > maxAgeHours) {
  throw new Error(`Latest database backup is ${ageHours.toFixed(1)} hours old; maximum allowed is ${maxAgeHours} hours.`);
}

const hash = createHash("sha256");
for await (const chunk of createReadStream(backupPath)) hash.update(chunk);
if (hash.digest("hex") !== manifest.sha256) throw new Error(`Backup checksum mismatch: ${backupPath}`);

await new Promise<void>((resolve, reject) => {
  const restore = spawn("pg_restore", ["--list", backupPath], { stdio: "inherit" });
  restore.once("error", (error) => reject(new Error(`pg_restore could not start. Install PostgreSQL client tools first. ${error.message}`)));
  restore.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`pg_restore exited with code ${code ?? "unknown"}.`)));
});

console.log(`Backup health check passed: ${backupPath} (${ageHours.toFixed(1)} hours old).`);
