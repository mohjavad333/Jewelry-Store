import { randomUUID } from "node:crypto";
import { db } from "../db";

export type Address = { id: string; title: string; receiver: string; phone: string; details: string; postalCode: string };
export type AuthChallenge = { id: string; identifier: string; mode: "login" | "register"; name?: string; codeHash: string; expiresAt: number; attempts: number };

type AddressRow = { id: string; title: string; receiver: string; phone: string; details: string; postal_code: string };
type ChallengeRow = { id: string; identifier: string; mode: "login" | "register"; name: string | null; code_hash: string; expires_at: string | Date; attempts: number };

function toAddress(row: AddressRow): Address {
  return { id: row.id, title: row.title, receiver: row.receiver, phone: row.phone, details: row.details, postalCode: row.postal_code };
}

function toChallenge(row: ChallengeRow): AuthChallenge {
  return { id: row.id, identifier: row.identifier, mode: row.mode, ...(row.name ? { name: row.name } : {}), codeHash: row.code_hash, expiresAt: new Date(row.expires_at).getTime(), attempts: row.attempts };
}

const addressColumns = "id, title, receiver, phone, details, postal_code";

export async function listAddresses(userId: string) {
  const result = await db.query<AddressRow>(`SELECT ${addressColumns} FROM addresses WHERE user_id = $1 ORDER BY created_at`, [userId]);
  return result.rows.map(toAddress);
}

export async function createAddress(userId: string, address: Omit<Address, "id">) {
  const result = await db.query<AddressRow>(
    `INSERT INTO addresses (id, user_id, title, receiver, phone, details, postal_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${addressColumns}`,
    [randomUUID(), userId, address.title, address.receiver, address.phone, address.details, address.postalCode],
  );
  return toAddress(result.rows[0]);
}

export async function updateAddress(userId: string, addressId: string, address: Omit<Address, "id">) {
  const result = await db.query<AddressRow>(
    `UPDATE addresses
     SET title = $1, receiver = $2, phone = $3, details = $4, postal_code = $5
     WHERE id = $6 AND user_id = $7
     RETURNING ${addressColumns}`,
    [address.title, address.receiver, address.phone, address.details, address.postalCode, addressId, userId],
  );
  return result.rows[0] ? toAddress(result.rows[0]) : null;
}

export async function deleteAddress(userId: string, addressId: string) {
  const result = await db.query("DELETE FROM addresses WHERE id = $1 AND user_id = $2", [addressId, userId]);
  return result.rowCount > 0;
}

export async function createSession(tokenHash: string, userId: string, expiresAt: Date) {
  await db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [tokenHash, userId, expiresAt]);
}

export async function findSessionUserId(tokenHash: string) {
  const result = await db.query<{ user_id: string }>("SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > NOW()", [tokenHash]);
  return result.rows[0]?.user_id ?? null;
}

export async function deleteSession(tokenHash: string) {
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

export async function createAuthChallenge(challenge: AuthChallenge) {
  await db.query(
    `INSERT INTO auth_challenges (id, identifier, mode, name, code_hash, expires_at, attempts)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [challenge.id, challenge.identifier, challenge.mode, challenge.name ?? null, challenge.codeHash, new Date(challenge.expiresAt), challenge.attempts],
  );
}

export async function findAuthChallenge(id: string) {
  const result = await db.query<ChallengeRow>("SELECT id, identifier, mode, name, code_hash, expires_at, attempts FROM auth_challenges WHERE id = $1", [id]);
  return result.rows[0] ? toChallenge(result.rows[0]) : null;
}

export async function incrementAuthChallengeAttempts(id: string) {
  const result = await db.query<ChallengeRow>("UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = $1 RETURNING id, identifier, mode, name, code_hash, expires_at, attempts", [id]);
  return result.rows[0] ? toChallenge(result.rows[0]) : null;
}

export async function deleteAuthChallenge(id: string) {
  await db.query("DELETE FROM auth_challenges WHERE id = $1", [id]);
}
