import "dotenv/config";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { assertBackupObjectKey, assertIndependentBackupStorage, backupAuthHeaders, decryptBackupFile, getBackupObjectUrl, parseBackupManifest, sha256File } from "./backup-storage";

export async function downloadRemoteBackup(key: string) {
  const backupKey = assertBackupObjectKey(key);
  const template = process.env.BACKUP_STORAGE_URL_TEMPLATE?.trim();
  assertIndependentBackupStorage(process.env.DATABASE_URL?.trim(), template);
  const headers = backupAuthHeaders(process.env.BACKUP_STORAGE_AUTH_TOKEN?.trim());
  const backupUrl = getBackupObjectUrl(template, backupKey);
  const manifestUrl = getBackupObjectUrl(template, `${backupKey}.sha256.json`);
  const manifestResponse = await fetch(manifestUrl, { headers, signal: AbortSignal.timeout(30_000) });
  if (!manifestResponse.ok) throw new Error(`Remote backup manifest download returned HTTP ${manifestResponse.status}.`);
  const manifest = parseBackupManifest(await manifestResponse.json(), backupKey);
  const backupResponse = await fetch(backupUrl, { headers, signal: AbortSignal.timeout(5 * 60_000) });
  if (!backupResponse.ok || !backupResponse.body) throw new Error(`Remote backup download returned HTTP ${backupResponse.status}.`);

  if (!manifest.encryption) throw new Error("Offsite backup is missing encryption metadata.");
  const directory = await mkdtemp(path.join(tmpdir(), "zarinsa-recovery-"));
  const encryptedPath = path.join(directory, "backup.enc");
  const backupPath = path.join(directory, backupKey);
  try {
    await pipeline(Readable.fromWeb(backupResponse.body as never), createWriteStream(encryptedPath, { mode: 0o600, flags: "wx" }));
    if (await sha256File(encryptedPath) !== manifest.encryption.sha256) throw new Error("Downloaded offsite ciphertext checksum does not match its manifest.");
    await decryptBackupFile(encryptedPath, backupPath, manifest.encryption);
    if (await sha256File(backupPath) !== manifest.sha256) throw new Error("Decrypted offsite backup checksum does not match its manifest.");
    return {
      backupPath,
      manifest,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function readLocalBackupManifest(backupPath: string) {
  const manifestPath = `${backupPath}.sha256.json`;
  const manifest = parseBackupManifest(JSON.parse(await readFile(manifestPath, "utf8")), path.basename(backupPath));
  if (await sha256File(backupPath) !== manifest.sha256) throw new Error("Local backup checksum does not match its manifest.");
  return manifest;
}
