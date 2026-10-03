import type { PoolClient } from "pg";
import { db } from "../db";
import { createNotificationWithClient } from "./notifications";

export type OrderItem = { id: number; name: string; quantity: number; weight: number; price: number; image: string; customization?: string };
export type OrderTotals = { base: number; making: number; profit: number; tax: number; shipping: number; insurance: number; customization: number; total: number };
export type OrderAddress = { id: string; title: string; receiver: string; phone: string; details: string; postalCode: string };
export type PersistedOrder = { id: string; userId: string; date: string; status: string; tracking: string; note?: string; expiresAt: string | null; stockReleased: boolean; items: OrderItem[]; address: OrderAddress; totals: OrderTotals; paymentMethod: string };

export class InsufficientStockError extends Error {}
export class InvalidOrderTransitionError extends Error {}
export class OrderNotCancellableError extends Error {}

type OrderRow = { id: string; user_id: string; date: string | Date; status: string; tracking: string; note: string | null; expires_at: string | Date | null; stock_released: boolean; address: OrderAddress; totals: OrderTotals; payment_method: string };
type ItemRow = { product_id: number; name: string; quantity: number; weight: number | string; price: number | string; image: string; customization: string | null };

function toOrder(row: OrderRow, items: ItemRow[]): PersistedOrder {
  return {
    id: row.id,
    userId: row.user_id,
    date: new Date(row.date).toISOString(),
    status: row.status,
    tracking: row.tracking,
    ...(row.note ? { note: row.note } : {}),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    stockReleased: row.stock_released,
    items: items.map((item) => ({
      id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      weight: Number(item.weight),
      price: Number(item.price),
      image: item.image,
      ...(item.customization ? { customization: item.customization } : {}),
    })),
    address: row.address,
    totals: row.totals,
    paymentMethod: row.payment_method,
  };
}

const orderColumns = "id, user_id, date, status, tracking, note, expires_at, stock_released, address, totals, payment_method";

async function loadOrder(client: Pick<PoolClient, "query">, id: string) {
  const orderResult = await client.query<OrderRow>(`SELECT ${orderColumns} FROM orders WHERE id = $1`, [id]);
  if (!orderResult.rows[0]) return null;
  const itemResult = await client.query<ItemRow>("SELECT product_id, name, quantity, weight, price, image, customization FROM order_items WHERE order_id = $1 ORDER BY id", [id]);
  return toOrder(orderResult.rows[0], itemResult.rows);
}

export async function createOrderInDatabase(order: PersistedOrder, idempotencyKey: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existingResult = await client.query<{ id: string }>("SELECT id FROM orders WHERE user_id = $1 AND idempotency_key = $2", [order.userId, idempotencyKey]);
    if (existingResult.rows[0]) {
      const existing = await loadOrder(client, existingResult.rows[0].id);
      await client.query("COMMIT");
      return { order: existing!, created: false };
    }

    for (const item of order.items) {
      const stockResult = await client.query<{ id: number }>(
        `UPDATE products SET stock = stock - $2, updated_at = NOW()
         WHERE id = $1 AND active = TRUE AND stock >= $2
         RETURNING id`,
        [item.id, item.quantity],
      );
      if (!stockResult.rows[0]) throw new InsufficientStockError(item.name);
    }

    await client.query(
      `INSERT INTO orders (id, user_id, date, status, tracking, note, expires_at, stock_released, address, totals, payment_method, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [order.id, order.userId, order.date, order.status, order.tracking, order.note ?? null, order.expiresAt, order.stockReleased, order.address, order.totals, order.paymentMethod, idempotencyKey],
    );
    for (const item of order.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, quantity, weight, price, image, customization)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [order.id, item.id, item.name, item.quantity, item.weight, item.price, item.image, item.customization ?? null],
      );
    }
    await createNotificationWithClient(client, { id: `${order.id}-status`, userId: order.userId, orderId: order.id, type: "order_status", title: `وضعیت سفارش ${order.id}`, text: `وضعیت سفارش شما: ${order.status}` });
    await createNotificationWithClient(client, { id: `${order.id}-invoice`, userId: order.userId, orderId: order.id, type: "invoice", title: "فاکتور سفارش آماده است", text: "فاکتور دیجیتال سفارش شما قابل مشاهده است." });
    await client.query("COMMIT");
    return { order, created: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listOrdersFromDatabase(userId?: string) {
  const values = userId ? [userId] : [];
  const where = userId ? "WHERE user_id = $1" : "";
  const result = await db.query<OrderRow>(`SELECT ${orderColumns} FROM orders ${where} ORDER BY date DESC`, values);
  return Promise.all(result.rows.map(async (row) => {
    const items = await db.query<ItemRow>("SELECT product_id, name, quantity, weight, price, image, customization FROM order_items WHERE order_id = $1 ORDER BY id", [row.id]);
    return toOrder(row, items.rows);
  }));
}

export async function listCustomerOrderSummaries(userId: string) {
  const result = await db.query<{ id: string; date: string | Date; status: string; total: number | string }>(
    "SELECT id, date, status, totals->>'total' AS total FROM orders WHERE user_id = $1 ORDER BY date DESC",
    [userId],
  );
  return result.rows.map((row) => ({ id: row.id, date: new Date(row.date).toISOString(), status: row.status, total: Number(row.total) }));
}

export async function getOrderFromDatabase(id: string, userId?: string) {
  const values = userId ? [id, userId] : [id];
  const where = userId ? "WHERE id = $1 AND user_id = $2" : "WHERE id = $1";
  const result = await db.query<OrderRow>(`SELECT ${orderColumns} FROM orders ${where}`, values);
  if (!result.rows[0]) return null;
  const items = await db.query<ItemRow>("SELECT product_id, name, quantity, weight, price, image, customization FROM order_items WHERE order_id = $1 ORDER BY id", [id]);
  return toOrder(result.rows[0], items.rows);
}

export async function getOrderByTracking(tracking: string) {
  const result = await db.query<OrderRow>(`SELECT ${orderColumns} FROM orders WHERE tracking = $1`, [tracking]);
  if (!result.rows[0]) return null;
  const items = await db.query<ItemRow>("SELECT product_id, name, quantity, weight, price, image, customization FROM order_items WHERE order_id = $1 ORDER BY id", [result.rows[0].id]);
  return toOrder(result.rows[0], items.rows);
}

const statusTransitions: Record<string, string[]> = {
  "در انتظار پرداخت": ["پرداخت شده", "لغو شده"],
  "پرداخت شده": ["در حال آماده‌سازی"],
  "در حال آماده‌سازی": ["آماده ارسال"],
  "آماده ارسال": ["ارسال شده"],
  "ارسال شده": ["تحویل شده"],
  "تحویل شده": [],
  "لغو شده": [],
};

async function releaseOrderStock(client: Pick<PoolClient, "query">, orderId: string) {
  const items = await client.query<{ product_id: number; quantity: number }>("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [orderId]);
  for (const item of items.rows) {
    await client.query("UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2", [item.quantity, item.product_id]);
  }
}

export async function releaseExpiredOrders() {
  const client = await db.connect();
  let released = 0;
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string; user_id: string }>("SELECT id, user_id FROM orders WHERE status = 'در انتظار پرداخت' AND stock_released = FALSE AND expires_at IS NOT NULL AND expires_at <= NOW() FOR UPDATE");
    for (const order of result.rows) {
      await releaseOrderStock(client, order.id);
      await client.query("UPDATE orders SET status = 'لغو شده', stock_released = TRUE, expires_at = NULL WHERE id = $1", [order.id]);
      await createNotificationWithClient(client, { id: `${order.id}-expired-${Date.now()}-${released}`, userId: order.user_id, orderId: order.id, type: "order_status", title: `سفارش ${order.id} لغو شد`, text: "مهلت پرداخت سفارش به پایان رسید و موجودی آزاد شد." });
      released += 1;
    }
    await client.query("COMMIT");
    return released;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelOrderForUser(id: string, userId: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<OrderRow>(`SELECT ${orderColumns} FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE`, [id, userId]);
    if (!result.rows[0]) {
      await client.query("COMMIT");
      return null;
    }
    if (result.rows[0].status !== "در انتظار پرداخت" || result.rows[0].stock_released) throw new OrderNotCancellableError();
    await releaseOrderStock(client, id);
    await client.query("UPDATE orders SET status = 'لغو شده', stock_released = TRUE, expires_at = NULL WHERE id = $1", [id]);
    await createNotificationWithClient(client, { id: `${id}-cancelled-${Date.now()}`, userId, orderId: id, type: "order_status", title: `سفارش ${id} لغو شد`, text: "سفارش شما لغو شد و موجودی آزاد شد." });
    const order = await loadOrder(client, id);
    await client.query("COMMIT");
    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrderInDatabase(id: string, changes: { status?: string; tracking?: string; note?: string }) {
  const entries = Object.entries(changes);
  const columnMap: Record<string, string> = { status: "status", tracking: "tracking", note: "note" };
  const assignments: string[] = [];
  const values: unknown[] = [];

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query<OrderRow>(`SELECT ${orderColumns} FROM orders WHERE id = $1 FOR UPDATE`, [id]);
    const current = currentResult.rows[0];
    if (!current) {
      await client.query("COMMIT");
      return null;
    }
    if (changes.status && changes.status !== current.status && !statusTransitions[current.status]?.includes(changes.status)) throw new InvalidOrderTransitionError();

    for (const [key, value] of entries) {
      const column = columnMap[key];
      if (!column) continue;
      values.push(value ?? null);
      assignments.push(`${column} = $${values.length}`);
    }
    if (changes.status === "لغو شده") {
      if (!current.stock_released) await releaseOrderStock(client, id);
      assignments.push("stock_released = TRUE", "expires_at = NULL");
    } else if (changes.status && changes.status !== "در انتظار پرداخت") {
      assignments.push("expires_at = NULL");
    }
    values.push(id);
    await client.query(`UPDATE orders SET ${assignments.join(", ")} WHERE id = $${values.length}`, values);
    const order = await loadOrder(client, id);
    if (changes.status && order && changes.status !== current.status) {
      await createNotificationWithClient(client, { id: `${id}-status-${Date.now()}`, userId: order.userId, orderId: id, type: "order_status", title: `وضعیت سفارش ${id}`, text: `وضعیت سفارش شما: ${changes.status}` });
    }
    await client.query("COMMIT");
    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
