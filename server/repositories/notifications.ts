import type { PoolClient } from "pg";
import { db } from "../db";

export type Notification = { id: string; title: string; text: string; date: string; read: boolean };

type NotificationRow = { id: string; title: string; text: string; created_at: string | Date; read: boolean };

function toNotification(row: NotificationRow): Notification {
  return { id: row.id, title: row.title, text: row.text, date: new Date(row.created_at).toISOString(), read: row.read };
}

const notificationColumns = "id, title, text, created_at, read";

export async function listNotificationsForUser(userId: string) {
  const result = await db.query<NotificationRow>(`SELECT ${notificationColumns} FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
  return result.rows.map(toNotification);
}

export async function createNotificationWithClient(client: PoolClient, input: { id: string; userId: string; orderId?: string; type: string; title: string; text: string }) {
  await client.query(
    `INSERT INTO notifications (id, user_id, order_id, type, title, text)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.id, input.userId, input.orderId ?? null, input.type, input.title, input.text],
  );
}

export async function createNotification(input: { id: string; userId: string; orderId?: string; type: string; title: string; text: string }) {
  await db.query(
    `INSERT INTO notifications (id, user_id, order_id, type, title, text)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.id, input.userId, input.orderId ?? null, input.type, input.title, input.text],
  );
}

export async function markNotificationRead(userId: string, id: string) {
  const result = await db.query("UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2", [id, userId]);
  return result.rowCount > 0;
}
