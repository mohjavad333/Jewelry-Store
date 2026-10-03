import "dotenv/config";
import "dotenv/config";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { assertBackupObjectKey, assertIndependentBackupStorage, backupAuthHeaders, encryptBackupFile, getBackupObjectUrl, parseBackupManifest, sha256File, sha256Response } from "./backup-storage";

const backupDirectory = path.resolve(process.env.BACKUP_DIR ?? "backups");
const configuredBackup = process.env.BACKUP_FILE;
const storageUrlTemplate = process.env.BACKUP_STORAGE_URL_TEMPLATE?.trim();
const uploadToken = process.env.BACKUP_STORAGE_AUTH_TOKEN?.trim();

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

async function main() {
  if (process.env.BACKUP_REMOTE_REQUIRED !== "true") throw new Error("Set BACKUP_REMOTE_REQUIRED=true; offsite backups are mandatory.");
  assertIndependentBackupStorage(process.env.DATABASE_URL?.trim(), storageUrlTemplate);
  const backupPath = await findBackup();
  if (!backupPath) throw new Error("No database backup was found for offsite upload.");

  const backupKey = assertBackupObjectKey(path.basename(backupPath));
  const manifestKey = `${backupKey}.sha256.json`;
  const manifestPath = `${backupPath}.sha256.json`;
  const localManifest = parseBackupManifest(JSON.parse(await readFile(manifestPath, "utf8")), backupKey);
  if (await sha256File(backupPath) !== localManifest.sha256) throw new Error("Local backup checksum does not match its manifest.");
  const encrypted = await encryptBackupFile(backupPath);
  try {
    const manifest = { ...localManifest, encryption: encrypted.encryption };
    const backupUrl = getBackupObjectUrl(storageUrlTemplate, backupKey);
    const manifestUrl = getBackupObjectUrl(storageUrlTemplate, manifestKey);
    const headers = backupAuthHeaders(uploadToken);
    const encryptedSize = (await stat(encrypted.encryptedPath)).size;
    const backupResponse = await fetch(backupUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Length": String(encryptedSize) },
      body: Readable.toWeb(createReadStream(encrypted.encryptedPath)),
      duplex: "half",
      signal: AbortSignal.timeout(15 * 60_000),
    } as RequestInit & { duplex: "half" });
    if (!backupResponse.ok) throw new Error(`Remote backup upload returned HTTP ${backupResponse.status}.`);

    const manifestResponse = await fetch(manifestUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(manifest),
      signal: AbortSignal.timeout(30_000),
    });
    if (!manifestResponse.ok) throw new Error(`Remote backup manifest upload returned HTTP ${manifestResponse.status}.`);

    const [remoteBackupResponse, remoteManifestResponse] = await Promise.all([
      fetch(backupUrl, { headers, signal: AbortSignal.timeout(15 * 60_000) }),
      fetch(manifestUrl, { headers, signal: AbortSignal.timeout(30_000) }),
    ]);
    if (!remoteManifestResponse.ok) throw new Error(`Remote backup manifest verification returned HTTP ${remoteManifestResponse.status}.`);
    const remoteManifest = parseBackupManifest(await remoteManifestResponse.json(), backupKey);
    const remoteHash = await sha256Response(remoteBackupResponse);
    if (remoteManifest.sha256 !== manifest.sha256 || remoteManifest.encryption?.sha256 !== encrypted.encryption.sha256 || remoteHash !== encrypted.encryption.sha256) {
      throw new Error("Offsite backup read-back verification failed.");
    }

    console.log(`Encrypted offsite backup verified: ${backupKey}.`);
  } finally {
    await encrypted.cleanup();
  }
}

await main();
