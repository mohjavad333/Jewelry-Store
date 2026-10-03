import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { orderSchema } from "../validators/orders";
import { calculateCustomizationCost, calculateGoldPricing } from "../../shared/gold";
import { getAuthenticatedUser } from "../services/auth-session";
import { getGoldPriceSnapshot } from "../services/gold-price";
import { getProductFromDatabase } from "../repositories/products";
import { cancelOrderForUser, createOrderInDatabase, getOrderByTracking, getOrderFromDatabase, InsufficientStockError, listOrdersFromDatabase, OrderNotCancellableError, releaseExpiredOrders, type OrderAddress, type PersistedOrder } from "../repositories/orders";
import { listNotificationsForUser, markNotificationRead } from "../repositories/notifications";
import { dispatchUserNotification } from "../services/notification-delivery";

export type Order = PersistedOrder;

export async function createOrder(req: Request, res: Response) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: "برای ثبت سفارش ابتدا وارد حساب شوید." });
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات سفارش کامل یا معتبر نیست." });

  await releaseExpiredOrders();
  const snapshot = await getGoldPriceSnapshot();
  const products = await Promise.all(parsed.data.items.map((item) => getProductFromDatabase(item.id)));
  if (products.some((product, index) => !product || !product.active || product.stock < parsed.data.items[index].quantity)) {
    const unavailable = products.findIndex((product, index) => !product || !product.active || product.stock < parsed.data.items[index].quantity);
    return res.status(409).json({ message: `موجودی ${parsed.data.items[unavailable]?.name ?? "محصول"} کافی نیست.` });
  }

  const items = parsed.data.items.map((item, index) => {
    const product = products[index]!;
    const pricing = calculateGoldPricing(snapshot, { weight: product.weight, karat: product.karat });
    const customization = item.customization ?? "";
    const customizationCost = calculateCustomizationCost(customization);
    return { id: product.id, name: product.name, quantity: item.quantity, weight: product.weight, price: pricing.total + customizationCost, image: product.image, customization: item.customization };
  });
  const base = items.reduce((sum, item, index) => sum + calculateGoldPricing(snapshot, { weight: products[index]!.weight, karat: products[index]!.karat }).rawGold * item.quantity, 0);
  const making = Math.round(base * 0.12);
  const profit = Math.round((base + making) * 0.07);
  const tax = Math.round((making + profit) * 0.1);
  const shipping = base >= 5_000_000 ? 0 : 180_000;
  const insurance = parsed.data.insurance ? Math.round(base * 0.003) : 0;
  const customization = items.reduce((sum, item, index) => sum + (item.price - calculateGoldPricing(snapshot, { weight: products[index]!.weight, karat: products[index]!.karat }).total) * item.quantity, 0);
  const order: Order = { id: `ZS-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`, userId: user.id, date: new Date().toISOString(), status: "در انتظار پرداخت", tracking: String(1000000000 + Math.floor(Math.random() * 8999999999)), items, address: parsed.data.address as OrderAddress, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), stockReleased: false, totals: { base, making, profit, tax, shipping, insurance, customization, total: base + making + profit + tax + shipping + insurance + customization }, paymentMethod: parsed.data.paymentMethod };

  try {
    const result = await createOrderInDatabase(order, parsed.data.idempotencyKey);
    if (result.created) {
      dispatchUserNotification({ userId: result.order.userId, title: `وضعیت سفارش ${result.order.id}`, text: `وضعیت سفارش شما: ${result.order.status}` });
      dispatchUserNotification({ userId: result.order.userId, title: "فاکتور سفارش آماده است", text: "فاکتور دیجیتال سفارش شما قابل مشاهده است." });
    }
    res.status(result.created ? 201 : 200).json({ order: result.order });
  } catch (error) {
    if (error instanceof InsufficientStockError) return res.status(409).json({ message: `موجودی ${error.message} کافی نیست.` });
    throw error;
  }
}

export async function listOrders(req: Request, res: Response) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: "برای مشاهده سفارش‌ها ابتدا وارد حساب شوید." });
  await releaseExpiredOrders();
  res.json({ orders: await listOrdersFromDatabase(user.id) });
}

const timelineFor = (order: Order) => [
  { title: "ثبت سفارش", text: "سفارش شما در زرین‌سا ثبت شده است.", completed: true, date: order.date },
  { title: "پرداخت", text: order.status === "در انتظار پرداخت" ? "در انتظار تکمیل پرداخت" : "پرداخت سفارش تأیید شده است.", completed: order.status !== "در انتظار پرداخت", date: order.date },
  { title: "آماده‌سازی", text: "قطعه شما پس از تأیید پرداخت آماده می‌شود.", completed: ["در حال آماده‌سازی", "آماده ارسال", "ارسال شده", "تحویل شده"].includes(order.status), date: "" },
  { title: "ارسال و تحویل", text: "کد رهگیری مرسوله برای شما فعال می‌شود.", completed: ["ارسال شده", "تحویل شده"].includes(order.status), date: "" },
];

export async function listNotifications(req: Request, res: Response) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: "برای مشاهده اعلان‌ها ابتدا وارد حساب شوید." });
  res.json({ notifications: await listNotificationsForUser(user.id) });
}

export async function markNotificationAsRead(req: Request, res: Response) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: "برای ادامه وارد حساب شوید." });
  const updated = await markNotificationRead(user.id, String(req.params.id));
  if (!updated) return res.status(404).json({ message: "اعلان پیدا نشد." });
  res.status(204).end();
}

export async function cancelOrder(req: Request, res: Response) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: "برای لغو سفارش ابتدا وارد حساب شوید." });
  try {
    const order = await cancelOrderForUser(String(req.params.id), user.id);
    if (!order) return res.status(404).json({ message: "سفارش پیدا نشد." });
    dispatchUserNotification({ userId: user.id, title: `سفارش ${order.id} لغو شد`, text: "سفارش شما لغو شد و موجودی آزاد شد." });
    res.json({ order });
  } catch (error) {
    if (error instanceof OrderNotCancellableError) return res.status(409).json({ message: "فقط سفارش‌های در انتظار پرداخت قابل لغو هستند." });
    throw error;
  }
}

export async function getOrder(req: Request, res: Response) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: "برای مشاهده سفارش ابتدا وارد حساب شوید." });
  const order = await getOrderFromDatabase(String(req.params.id), user.id);
  if (!order) return res.status(404).json({ message: "سفارش پیدا نشد." });
  res.json({ order, timeline: timelineFor(order) });
}

export async function trackOrder(req: Request, res: Response) {
  await releaseExpiredOrders();
  const order = await getOrderByTracking(String(req.params.tracking));
  if (!order) return res.status(404).json({ message: "سفارشی با این کد رهگیری پیدا نشد." });
  res.json({ order: { id: order.id, date: order.date, status: order.status, tracking: order.tracking, items: order.items, totals: order.totals }, timeline: timelineFor(order) });
}
