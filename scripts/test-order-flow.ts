import { createHash } from "node:crypto";
import { closeDatabase, db } from "../server/db";

type Json = Record<string, any>;

const baseUrl = process.env.ORDER_FLOW_BASE_URL ?? "http://localhost:8080";
const identifier = `order-flow-${Date.now()}@example.com`;
const userName = "کاربر تست ثبت سفارش";
const adminKey = process.env.ADMIN_API_KEY ?? "zarinsa-admin-dev";
let userCookie = "";
let adminCookie = "";
let userId = "";
let orderId = "";
const createdOrderIds: string[] = [];
let productId = 0;
let originalStock = 0;
let addressId = "";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request(path: string, options: RequestInit = {}, cookie = "") {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const raw = await response.text();
  let body: Json = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
  const setCookie = response.headers.get("set-cookie");
  return { response, body, cookie: setCookie?.split(";")[0] ?? "" };
}

async function expectStatus(path: string, options: RequestInit, status: number, cookie = "") {
  const result = await request(path, options, cookie);
  assert(result.response.status === status, `${path} expected ${status}, got ${result.response.status}: ${result.body.message ?? ""}`);
  return result;
}

async function cleanup() {
  for (const id of createdOrderIds) await db.query("DELETE FROM orders WHERE id = $1", [id]);
  if (orderId && !createdOrderIds.includes(orderId)) await db.query("DELETE FROM orders WHERE id = $1", [orderId]);
  if (userId) {
    await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await db.query("DELETE FROM auth_challenges WHERE identifier = $1", [identifier]);
    await db.query("DELETE FROM addresses WHERE user_id = $1", [userId]);
    await db.query("DELETE FROM users WHERE id = $1", [userId]);
  }
  if (productId) await db.query("UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2", [originalStock, productId]);
  if (adminCookie) await db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [createHash("sha256").update(adminCookie.split("=")[1]).digest("hex")]);
}

async function run() {
  const registration = await expectStatus("/api/auth/request-code", { method: "POST", body: JSON.stringify({ identifier, mode: "register", name: userName }) }, 200);
  assert(registration.body.challengeId && registration.body.devCode, "registration challenge was not returned");

  const verification = await expectStatus("/api/auth/verify-code", { method: "POST", body: JSON.stringify({ challengeId: registration.body.challengeId, code: registration.body.devCode }) }, 200);
  userCookie = verification.cookie;
  userId = verification.body.user?.id;
  assert(userCookie && userId, "user session was not created");

  const me = await expectStatus("/api/auth/me", {}, 200, userCookie);
  assert(me.body.user.id === userId, "authenticated user lookup failed");

  const profileName = `${userName} به‌روزشده`;
  const updatedProfile = await expectStatus("/api/account/profile", { method: "PATCH", body: JSON.stringify({ name: profileName }) }, 200, userCookie);
  assert(updatedProfile.body.user.name === profileName, "profile name was not updated");
  const updatedMe = await expectStatus("/api/auth/me", {}, 200, userCookie);
  assert(updatedMe.body.user.name === profileName, "profile name was not persisted");

  const address = await expectStatus("/api/account/addresses", { method: "POST", body: JSON.stringify({ title: "آدرس تست", receiver: userName, phone: "09120000000", details: "تهران، خیابان تست، پلاک ۱", postalCode: "1234567890" }) }, 201, userCookie);
  addressId = address.body.address?.id;
  assert(addressId, "address was not persisted");
  const updatedAddress = await expectStatus(`/api/account/addresses/${addressId}`, { method: "PATCH", body: JSON.stringify({ ...address.body.address, details: "تهران، خیابان تست، پلاک ۲" }) }, 200, userCookie);
  assert(updatedAddress.body.address.details.includes("پلاک ۲"), "address was not updated");
  address.body.address = updatedAddress.body.address;

  const products = await expectStatus("/api/products", {}, 200);
  const product = products.body.products?.find((item: Json) => item.active && item.stock > 0);
  assert(product, "no in-stock product available for order flow");
  productId = product.id;
  originalStock = product.stock;

  const orderPayload = { idempotencyKey: `order-flow-${Date.now()}`, address: { ...address.body.address }, insurance: true, paymentMethod: "gateway", items: [{ id: product.id, name: product.name, weight: product.weight, karat: product.karat, quantity: 1, image: product.image }] };
  const created = await expectStatus("/api/orders", { method: "POST", body: JSON.stringify(orderPayload) }, 201, userCookie);
  orderId = created.body.order?.id;
  assert(orderId && created.body.order.totals.total > 0, "order was not persisted with totals");
  createdOrderIds.push(orderId);

  const repeated = await expectStatus("/api/orders", { method: "POST", body: JSON.stringify(orderPayload) }, 200, userCookie);
  assert(repeated.body.order.id === orderId, "idempotency returned a different order");

  const history = await expectStatus("/api/account/orders", {}, 200, userCookie);
  assert(history.body.orders.some((item: Json) => item.id === orderId), "order history does not contain the order");
  await expectStatus(`/api/account/orders/${orderId}`, {}, 200, userCookie);

  const tracking = created.body.order.tracking;
  const tracked = await expectStatus(`/api/orders/track/${tracking}`, {}, 200);
  assert(tracked.body.order.id === orderId, "tracking lookup returned the wrong order");

  const notifications = await expectStatus("/api/account/notifications", {}, 200, userCookie);
  assert(notifications.body.notifications.length === 2, "initial order notifications were not persisted");

  const adminLogin = await expectStatus("/api/admin/login", { method: "POST", body: JSON.stringify({ key: adminKey }) }, 200);
  adminCookie = adminLogin.cookie;
  assert(adminCookie, "admin session was not created");
  const customerOrders = await expectStatus(`/api/admin/customers/${userId}/orders`, {}, 200, adminCookie);
  assert(customerOrders.body.orders.some((item: Json) => item.id === orderId && item.total > 0), "admin customer order history did not include the customer's order summary");
  await expectStatus(`/api/admin/orders/${orderId}/status`, { method: "PATCH", headers: { "x-admin-key": adminKey }, body: JSON.stringify({ status: "پرداخت شده" }) }, 200, adminCookie);
  const statusUpdate = await expectStatus(`/api/admin/orders/${orderId}/status`, { method: "PATCH", headers: { "x-admin-key": adminKey }, body: JSON.stringify({ status: "در حال آماده‌سازی" }) }, 200, adminCookie);
  assert(statusUpdate.body.order.status === "در حال آماده‌سازی", "admin status update failed");
  await expectStatus(`/api/admin/orders/${orderId}/status`, { method: "PATCH", headers: { "x-admin-key": adminKey }, body: JSON.stringify({ status: "تحویل شده" }) }, 409, adminCookie);

  const secondPayload = { ...orderPayload, idempotencyKey: `order-flow-cancel-${Date.now()}` };
  const secondCreated = await expectStatus("/api/orders", { method: "POST", body: JSON.stringify(secondPayload) }, 201, userCookie);
  const secondOrderId = secondCreated.body.order?.id;
  assert(secondOrderId, "second order was not persisted");
  createdOrderIds.push(secondOrderId);
  const cancelled = await expectStatus(`/api/account/orders/${secondOrderId}/cancel`, { method: "POST" }, 200, userCookie);
  assert(cancelled.body.order.status === "لغو شده" && cancelled.body.order.stockReleased, "order cancellation did not release stock");
  const productsAfterCancellation = await expectStatus("/api/products", {}, 200);
  const productAfterCancellation = productsAfterCancellation.body.products.find((item: Json) => item.id === productId);
  assert(productAfterCancellation.stock === originalStock - 1, "cancelled order stock was not restored correctly");

  const expiringPayload = { ...orderPayload, idempotencyKey: `order-flow-expiry-${Date.now()}` };
  const expiring = await expectStatus("/api/orders", { method: "POST", body: JSON.stringify(expiringPayload) }, 201, userCookie);
  const expiringOrderId = expiring.body.order?.id;
  assert(expiringOrderId, "expiring order was not persisted");
  createdOrderIds.push(expiringOrderId);
  await db.query("UPDATE orders SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [expiringOrderId]);
  const expiredHistory = await expectStatus("/api/account/orders", {}, 200, userCookie);
  const expiredOrder = expiredHistory.body.orders.find((item: Json) => item.id === expiringOrderId);
  assert(expiredOrder?.status === "لغو شده" && expiredOrder.stockReleased, "expired order was not cancelled automatically");

  const updatedNotifications = await expectStatus("/api/account/notifications", {}, 200, userCookie);
  assert(updatedNotifications.body.notifications.length === 10, "status, cancellation, or expiry notifications were not persisted");
  const unread = updatedNotifications.body.notifications.find((item: Json) => !item.read);
  assert(unread, "expected an unread notification");
  await expectStatus(`/api/account/notifications/${unread.id}/read`, { method: "PATCH" }, 204, userCookie);
  const readNotifications = await expectStatus("/api/account/notifications", {}, 200, userCookie);
  assert(readNotifications.body.notifications.find((item: Json) => item.id === unread.id)?.read === true, "notification read state was not persisted");

  const adminOverview = await expectStatus("/api/admin/overview", { headers: { "x-admin-key": adminKey } }, 200, adminCookie);
  assert(adminOverview.body.orders.some((item: Json) => item.id === orderId), "admin overview does not contain the order");
  assert(adminOverview.body.reports.salesLast7Days.length === 7, "admin sales report does not include seven daily buckets");
  assert(adminOverview.body.reports.cancelledOrders >= 2, "admin sales report does not count cancelled orders");
  assert(adminOverview.body.reports.topProducts.find((item: Json) => item.id === productId)?.sold >= 1, "admin product report does not count paid orders");
  console.log("Order flow passed: auth, address, order, idempotency, history, tracking, notifications, stock, customer reports, and admin status update");
}

try {
  await run();
} finally {
  await cleanup();
  await closeDatabase();
}
