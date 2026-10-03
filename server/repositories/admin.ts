import { randomUUID } from "node:crypto";
import { db } from "../db";

export type AdminRole = "owner" | "orders" | "products" | "reports";
export type AdminUser = { id: string; name: string; identifier: string | null; role: AdminRole; active: boolean };
export type AdminActivity = { id: number; adminUserId: string | null; adminName: string | null; action: string; entityType: string | null; entityId: string | null; metadata: Record<string, unknown>; createdAt: string };

type AdminRow = { id: string; name: string; identifier: string | null; role: AdminRole; active: boolean };
type ActivityRow = { id: number; admin_user_id: string | null; admin_name: string | null; action: string; entity_type: string | null; entity_id: string | null; metadata: Record<string, unknown>; created_at: string | Date };

function toAdmin(row: AdminRow): AdminUser {
  return { id: row.id, name: row.name, identifier: row.identifier, role: row.role, active: row.active };
}

function toActivity(row: ActivityRow): AdminActivity {
  return { id: row.id, adminUserId: row.admin_user_id, adminName: row.admin_name, action: row.action, entityType: row.entity_type, entityId: row.entity_id, metadata: row.metadata, createdAt: new Date(row.created_at).toISOString() };
}

const adminColumns = "id, name, identifier, role, active";

export async function ensurePrimaryAdmin(role: AdminRole) {
  const result = await db.query<AdminRow>(
    `INSERT INTO admin_users (id, name, identifier, role, active)
     VALUES ('primary-admin', 'مدیر اصلی', 'primary-admin', $1, TRUE)
     ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, active = TRUE
     RETURNING ${adminColumns}`,
    [role],
  );
  return toAdmin(result.rows[0]);
}

export async function listAdminUsers() {
  const result = await db.query<AdminRow>(`SELECT ${adminColumns} FROM admin_users ORDER BY created_at`);
  return result.rows.map(toAdmin);
}

export async function createAdminUser(input: { name: string; identifier: string; keyHash: string; role: AdminRole }) {
  const result = await db.query<AdminRow>(
    `INSERT INTO admin_users (id, name, identifier, key_hash, role, active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING ${adminColumns}`,
    [randomUUID(), input.name, input.identifier, input.keyHash, input.role],
  );
  return toAdmin(result.rows[0]);
}

export async function findAdminByCredentials(identifier: string, keyHash: string) {
  const result = await db.query<AdminRow>(
    `SELECT ${adminColumns} FROM admin_users
     WHERE LOWER(identifier) = LOWER($1) AND key_hash = $2 AND active = TRUE`,
    [identifier, keyHash],
  );
  return result.rows[0] ? toAdmin(result.rows[0]) : null;
}

export async function updateAdminUser(id: string, changes: { name?: string; identifier?: string; keyHash?: string; role?: AdminRole; active?: boolean }) {
  const columnMap: Record<string, string> = { name: "name", identifier: "identifier", keyHash: "key_hash", role: "role", active: "active" };
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(changes)) {
    const column = columnMap[key];
    if (!column) continue;
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }
  if (!assignments.length) {
    const result = await db.query<AdminRow>(`SELECT ${adminColumns} FROM admin_users WHERE id = $1`, [id]);
    return result.rows[0] ? toAdmin(result.rows[0]) : null;
  }
  values.push(id);
  const result = await db.query<AdminRow>(`UPDATE admin_users SET ${assignments.join(", ")} WHERE id = $${values.length} RETURNING ${adminColumns}`, values);
  return result.rows[0] ? toAdmin(result.rows[0]) : null;
}

export async function createAdminSession(tokenHash: string, adminUserId: string, expiresAt: Date) {
  await db.query("INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at) VALUES ($1, $2, $3)", [tokenHash, adminUserId, expiresAt]);
}

export async function findAdminBySession(tokenHash: string) {
  const result = await db.query<AdminRow>(
    `SELECT a.id, a.name, a.identifier, a.role, a.active
     FROM admin_sessions s
     JOIN admin_users a ON a.id = s.admin_user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND a.active = TRUE`,
    [tokenHash],
  );
  return result.rows[0] ? toAdmin(result.rows[0]) : null;
}

export async function deleteAdminSession(tokenHash: string) {
  await db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
}

export async function recordAdminActivity(input: { adminUserId?: string; action: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> }) {
  await db.query(
    `INSERT INTO admin_activity_logs (admin_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.adminUserId ?? null, input.action, input.entityType ?? null, input.entityId ?? null, input.metadata ?? {}],
  );
}

export async function listAdminActivity(limit = 100) {
  const result = await db.query<ActivityRow>(
    `SELECT l.id, l.admin_user_id, a.name AS admin_name, l.action, l.entity_type, l.entity_id, l.metadata, l.created_at
     FROM admin_activity_logs l
     LEFT JOIN admin_users a ON a.id = l.admin_user_id
     ORDER BY l.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(toActivity);
}
