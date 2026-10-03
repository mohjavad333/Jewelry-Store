import "dotenv/config";
import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to create a backup.");

const backupDirectory = path.resolve(process.env.BACKUP_DIR ?? "backups");
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 30);
if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new Error("BACKUP_RETENTION_DAYS must be a positive integer.");

const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
const backupPath = path.join(backupDirectory, `zarinsa-${timestamp}.dump`);
const manifestPath = `${backupPath}.sha256.json`;

async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

await mkdir(backupDirectory, { recursive: true, mode: 0o700 });

try {
  await new Promise<void>((resolve, reject) => {
    const dump = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", backupPath, connectionString], { stdio: "inherit" });
    dump.once("error", (error) => reject(new Error(`pg_dump could not start. Install PostgreSQL client tools first. ${error.message}`)));
    dump.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code ?? "unknown"}.`)));
  });
  await chmod(backupPath, 0o600);
  await writeFile(manifestPath, `${JSON.stringify({ backup: path.basename(backupPath), sha256: await sha256File(backupPath), createdAt: new Date().toISOString() })}\n`, { mode: 0o600 });
  await chmod(manifestPath, 0o600);
} catch (error) {
  await unlink(backupPath).catch(() => undefined);
  await unlink(manifestPath).catch(() => undefined);
  throw error;
}

const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
const files = await readdir(backupDirectory);
for (const file of files.filter((name) => /^zarinsa-\d{8}T\d{6}(?:\d{3})?Z\.dump$/.test(name))) {
  const filePath = path.join(backupDirectory, file);
  const details = await stat(filePath);
  if (details.mtimeMs < cutoff && filePath !== backupPath) {
    await unlink(filePath);
    await unlink(`${filePath}.sha256.json`).catch(() => undefined);
  }
}

console.log(`Database backup created at ${backupPath}`);
