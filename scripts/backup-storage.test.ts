import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertBackupObjectKey, assertIndependentBackupStorage, backupAuthHeaders, decryptBackupFile, encryptBackupFile, getBackupObjectUrl, parseBackupManifest, sha256Response } from "./backup-storage";
import { assertIsolatedRecoveryEndpoint } from "./recovery-target";

const backupKey = "zarinsa-20260410T120000123Z.dump";
const sourceUrl = "postgresql://user:secret@source-db.example.com:5432/app";

describe("independent backup storage", () => {
  it("accepts timestamped keys and builds HTTPS object URLs", () => {
    assertBackupObjectKey(backupKey);
    expect(getBackupObjectUrl("https://storage.example.com/backups/{key}", backupKey).toString()).toBe(`https://storage.example.com/backups/${backupKey}`);
  });

  it("rejects unsafe keys and non-HTTPS storage URLs", () => {
    expect(() => assertBackupObjectKey("../secrets.dump")).toThrow();
    expect(() => getBackupObjectUrl("http://storage.example.com/{key}", backupKey)).toThrow("must use HTTPS");
    expect(() => getBackupObjectUrl("https://storage.example.com/{key}/{key}", backupKey)).toThrow("exactly one");
  });

  it("requires a private token and an independently configured HTTPS host", () => {
    const previous = process.env.BACKUP_STORAGE_INDEPENDENT;
    process.env.BACKUP_STORAGE_INDEPENDENT = "true";
    try {
      expect(backupAuthHeaders("storage-token")).toEqual({ Authorization: "Bearer storage-token" });
      expect(() => backupAuthHeaders()).toThrow("BACKUP_STORAGE_AUTH_TOKEN");
      expect(() => assertIndependentBackupStorage(sourceUrl, "https://storage.example.com/backups/{key}")).not.toThrow();
      expect(() => assertIndependentBackupStorage(sourceUrl, "https://source-db.example.com/backups/{key}")).toThrow("distinct HTTPS host");
    } finally {
      if (previous === undefined) delete process.env.BACKUP_STORAGE_INDEPENDENT;
      else process.env.BACKUP_STORAGE_INDEPENDENT = previous;
    }
  });

  it("validates manifests against the expected remote object", () => {
    const manifest = { backup: backupKey, sha256: "a".repeat(64), createdAt: new Date().toISOString() };
    expect(parseBackupManifest(manifest, backupKey)).toEqual(manifest);
    expect(() => parseBackupManifest(manifest, "different.dump")).toThrow();
  });

  it("encrypts and restores backup bytes only with a valid key", async () => {
    const originalKey = process.env.BACKUP_ENCRYPTION_KEY;
    process.env.BACKUP_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
    const directory = await mkdtemp(path.join(tmpdir(), "zarinsa-backup-test-"));
    const source = path.join(directory, "source.dump");
    const restored = path.join(directory, "restored.dump");
    await writeFile(source, "sensitive database bytes");
    try {
      const encrypted = await encryptBackupFile(source);
      try {
        expect(await readFile(encrypted.encryptedPath, "utf8")).not.toBe("sensitive database bytes");
        await decryptBackupFile(encrypted.encryptedPath, restored, encrypted.encryption);
        expect(await readFile(restored, "utf8")).toBe("sensitive database bytes");
        await expect(decryptBackupFile(encrypted.encryptedPath, path.join(directory, "invalid.dump"), { ...encrypted.encryption, authTag: "0".repeat(32) })).rejects.toThrow();
      } finally {
        await encrypted.cleanup();
      }
    } finally {
      if (originalKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
      else process.env.BACKUP_ENCRYPTION_KEY = originalKey;
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("hashes a remote response body", async () => {
    const body = "verified remote backup";
    const expected = createHash("sha256").update(body).digest("hex");
    await expect(sha256Response(new Response(body))).resolves.toBe(expected);
  });
});

describe("recovery target safety", () => {
  it("requires a separately named recovery endpoint", () => {
    expect(() => assertIsolatedRecoveryEndpoint(sourceUrl, "postgresql://user:secret@recovery-db.example.com:5432/app", "zarinsa_recovery")).not.toThrow();
    expect(() => assertIsolatedRecoveryEndpoint(sourceUrl, "postgresql://user:secret@source-db.example.com:5432/zarinsa_recovery", "zarinsa_recovery")).toThrow("separate");
    expect(() => assertIsolatedRecoveryEndpoint(sourceUrl, "postgresql://user:secret@recovery-db.example.com:5432/app", "app")).toThrow("RESTORE_DATABASE_NAME");
  });
});
