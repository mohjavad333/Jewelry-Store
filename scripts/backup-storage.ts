import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export type BackupEncryption = { algorithm: "aes-256-gcm"; iv: string; authTag: string; sha256: string };
export type BackupManifest = { backup: string; sha256: string; createdAt: string; encryption?: BackupEncryption };

const objectKeyPattern = /^zarinsa-\d{8}T\d{6}(?:\d{3})?Z\.dump(?:\.sha256\.json)?$/;

export function assertBackupObjectKey(value: string) {
  if (!/^zarinsa-\d{8}T\d{6}(?:\d{3})?Z\.dump$/.test(value)) {
    throw new Error("BACKUP_OBJECT_KEY must be a Zarinsa timestamped dump filename.");
  }
  return value;
}

export function assertIndependentBackupStorage(sourceDatabaseUrl: string | undefined, storageTemplate: string | undefined) {
  if (process.env.BACKUP_STORAGE_INDEPENDENT !== "true") {
    throw new Error("Set BACKUP_STORAGE_INDEPENDENT=true only after verifying storage is in a separate account and failure domain.");
  }
  if (!sourceDatabaseUrl || !storageTemplate) throw new Error("DATABASE_URL and BACKUP_STORAGE_URL_TEMPLATE are required.");
  const source = new URL(sourceDatabaseUrl);
  const storage = getBackupObjectUrl(storageTemplate, "zarinsa-19700101T000000000Z.dump");
  if (source.hostname.toLowerCase() === storage.hostname.toLowerCase()) {
    throw new Error("Backup storage must use a distinct HTTPS host from the source database.");
  }
}

export function getBackupObjectUrl(template: string | undefined, key: string) {
  if (!template?.includes("{key}") || template.indexOf("{key}") !== template.lastIndexOf("{key}")) {
    throw new Error("Backup storage URLs must contain exactly one {key} placeholder.");
  }
  if (!objectKeyPattern.test(key)) throw new Error("Backup storage object key is invalid.");

  const url = new URL(template.replace("{key}", encodeURIComponent(key)));
  if (url.protocol !== "https:") throw new Error("Backup storage URLs must use HTTPS.");
  if (url.username || url.password) throw new Error("Credentials must not be embedded in backup storage URLs.");
  return url;
}

export function parseBackupManifest(value: unknown, expectedBackup: string): BackupManifest {
  if (!value || typeof value !== "object") throw new Error("Remote backup manifest is invalid.");
  const manifest = value as Partial<BackupManifest>;
  if (manifest.backup !== expectedBackup || typeof manifest.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.sha256) || typeof manifest.createdAt !== "string" || !Number.isFinite(Date.parse(manifest.createdAt))) {
    throw new Error("Remote backup manifest is invalid.");
  }
  if (manifest.encryption && (manifest.encryption.algorithm !== "aes-256-gcm" || !/^[a-f0-9]{24}$/i.test(manifest.encryption.iv) || !/^[a-f0-9]{32}$/i.test(manifest.encryption.authTag) || !/^[a-f0-9]{64}$/i.test(manifest.encryption.sha256))) {
    throw new Error("Remote backup encryption metadata is invalid.");
  }
  return manifest as BackupManifest;
}

export function backupAuthHeaders(token?: string) {
  if (!token) throw new Error("BACKUP_STORAGE_AUTH_TOKEN is required for private offsite backups.");
  return { Authorization: `Bearer ${token}` };
}

function encryptionKey() {
  const value = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw new Error("BACKUP_ENCRYPTION_KEY must be a 32-byte hexadecimal key.");
  return Buffer.from(value, "hex");
}

export async function encryptBackupFile(filePath: string) {
  const key = encryptionKey();
  const directory = await mkdtemp(path.join(tmpdir(), "zarinsa-backup-upload-"));
  const encryptedPath = path.join(directory, "backup.enc");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  try {
    await pipeline(createReadStream(filePath), cipher, createWriteStream(encryptedPath, { mode: 0o600, flags: "wx" }));
    const encryption: BackupEncryption = {
      algorithm: "aes-256-gcm",
      iv: iv.toString("hex"),
      authTag: cipher.getAuthTag().toString("hex"),
      sha256: await sha256File(encryptedPath),
    };
    return { encryptedPath, encryption, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function decryptBackupFile(encryptedPath: string, outputPath: string, metadata: BackupEncryption) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(metadata.iv, "hex"));
  decipher.setAuthTag(Buffer.from(metadata.authTag, "hex"));
  await pipeline(createReadStream(encryptedPath), decipher, createWriteStream(outputPath, { mode: 0o600, flags: "wx" }));
}

export async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export async function sha256Response(response: Response) {
  if (!response.ok) throw new Error(`Remote backup download returned HTTP ${response.status}.`);
  if (!response.body) throw new Error("Remote backup download returned an empty body.");
  const hash = createHash("sha256");
  for await (const chunk of Readable.fromWeb(response.body as never)) hash.update(chunk);
  return hash.digest("hex");
}
