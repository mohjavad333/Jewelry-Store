import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { adminCreateSchema, adminCustomerIdSchema, adminLoginSchema, adminRoles as roles, adminUpdateSchema, productSchema, productUpdateSchema, stockSchema } from "../validators/admin";
import { orderUpdateSchema } from "../validators/orders";
import type { Product } from "../../shared/products";
import { findUserById, listUsers } from "../repositories/users";
import { createProductInDatabase, deactivateProductInDatabase, listProductsFromDatabase, setProductStockInDatabase, updateProductInDatabase } from "../repositories/products";
import { createAdminSession, createAdminUser, deleteAdminSession, ensurePrimaryAdmin, findAdminByCredentials, findAdminBySession, listAdminActivity, listAdminUsers, recordAdminActivity, updateAdminUser, type AdminRole, type AdminUser } from "../repositories/admin";
import { InvalidOrderTransitionError, listCustomerOrderSummaries, listOrdersFromDatabase, releaseExpiredOrders, updateOrderInDatabase } from "../repositories/orders";
import { dispatchUserNotification } from "../services/notification-delivery";
import { isProductionLikeEnvironment } from "../env";

const configuredKey = process.env.ADMIN_API_KEY ?? (isProductionLikeEnvironment() ? "" : "zarinsa-admin-dev");
const configuredRoleValue = process.env.ADMIN_API_ROLE as AdminRole | undefined;
const configuredRole: AdminRole = configuredRoleValue && roles[configuredRoleValue] ? configuredRoleValue : "owner";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const readAdminSession = (req: Request) => req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("zarinsa_admin_session="))?.slice("zarinsa_admin_session=".length);
const adminCookie = (token: string, maxAge: number) => `zarinsa_admin_session=${token}; HttpOnly; Path=/; SameSite=Lax${isProductionLikeEnvironment() ? "; Secure" : ""}; Max-Age=${maxAge}`;

async function getAdmin(req: Request): Promise<AdminUser | null> {
  const token = readAdminSession(req);
  if (token) {
    const sessionAdmin = await findAdminBySession(hash(token));
    if (sessionAdmin) return sessionAdmin;
  }
  if (configuredKey && req.headers["x-admin-key"] === configuredKey) return ensurePrimaryAdmin(configuredRole);
  return null;
}

export async function requireAdmin(req: Request, res: Response, allowedRoles: AdminRole[] = ["owner", "orders", "products", "reports"]) {
  const admin = await getAdmin(req);
  if (!admin) { res.status(401).json({ message: "دسترسی مدیریت معتبر نیست." }); return null; }
  if (!allowedRoles.includes(admin.role) && admin.role !== "owner") { res.status(403).json({ message: "نقش شما به این بخش دسترسی ندارد." }); return null; }
  return admin;
}

export async function adminLogin(req: Request, res: Response) {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات ورود مدیریت معتبر نیست." });
  const admin = configuredKey && parsed.data.key === configuredKey ? await ensurePrimaryAdmin(configuredRole) : parsed.data.identifier ? await findAdminByCredentials(parsed.data.identifier, hash(parsed.data.key)) : null;
  if (!admin) return res.status(401).json({ message: "کلید یا شناسه مدیریت نادرست است." });
  const token = randomBytes(32).toString("hex");
  await createAdminSession(hash(token), admin.id, new Date(Date.now() + 24 * 60 * 60 * 1000));
  await recordAdminActivity({ adminUserId: admin.id, action: "admin.login" });
  res.setHeader("Set-Cookie", adminCookie(token, 86400));
  res.json({ authenticated: true, role: admin.role, roleTitle: roles[admin.role].title, admin: { id: admin.id, name: admin.name, identifier: admin.identifier } });
}

export async function adminLogout(req: Request, res: Response) {
  const admin = await getAdmin(req);
  const token = readAdminSession(req);
  if (token) await deleteAdminSession(hash(token));
  if (admin) await recordAdminActivity({ adminUserId: admin.id, action: "admin.logout" });
  res.setHeader("Set-Cookie", adminCookie("", 0));
  res.status(204).end();
}

export async function adminAccessOverview(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner"]);
  if (!admin) return;
  const admins = await listAdminUsers();
  res.json({ admins: admins.map((item) => ({ ...item, roleTitle: roles[item.role].title })), roles });
}

export async function adminListActivity(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner"]);
  if (!admin) return;
  res.json({ activity: await listAdminActivity() });
}

export async function adminCreateUser(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner"]);
  if (!admin) return;
  const parsed = adminCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات مدیر کامل یا معتبر نیست." });
  try {
    const input = parsed.data as { name: string; identifier: string; key: string; role: AdminRole };
    const created = await createAdminUser({ ...input, keyHash: hash(input.key) });
    await recordAdminActivity({ adminUserId: admin.id, action: "admin.create", entityType: "admin", entityId: created.id });
    res.status(201).json({ admin: { ...created, roleTitle: roles[created.role].title } });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return res.status(409).json({ message: "این شناسه مدیریت قبلاً استفاده شده است." });
    throw error;
  }
}

export async function adminUpdateUser(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner"]);
  if (!admin) return;
  const parsed = adminUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات ویرایش مدیر معتبر نیست." });
  const adminId = String(req.params.id);
  if (adminId === "primary-admin" && parsed.data.active === false) return res.status(400).json({ message: "مدیر اصلی قابل غیرفعال‌سازی نیست." });
  const { key, ...changes } = parsed.data;
  try {
    const updated = await updateAdminUser(adminId, { ...changes, ...(key ? { keyHash: hash(key) } : {}) });
    if (!updated) return res.status(404).json({ message: "مدیر پیدا نشد." });
    await recordAdminActivity({ adminUserId: admin.id, action: "admin.update", entityType: "admin", entityId: adminId, metadata: changes });
    res.json({ admin: { ...updated, roleTitle: roles[updated.role].title } });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return res.status(409).json({ message: "این شناسه مدیریت قبلاً استفاده شده است." });
    throw error;
  }
}

export async function adminDeleteUser(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner"]);
  if (!admin) return;
  const adminId = String(req.params.id);
  if (adminId === "primary-admin") return res.status(400).json({ message: "مدیر اصلی قابل غیرفعال‌سازی نیست." });
  const updated = await updateAdminUser(adminId, { active: false });
  if (!updated) return res.status(404).json({ message: "مدیر پیدا نشد." });
  await recordAdminActivity({ adminUserId: admin.id, action: "admin.deactivate", entityType: "admin", entityId: adminId });
  res.json({ admin: { ...updated, roleTitle: roles[updated.role].title } });
}

export async function adminOverview(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner", "orders", "products", "reports"]);
  if (!admin) return;
  await releaseExpiredOrders();
  const canViewProducts = admin.role === "owner" || admin.role === "products";
  const canViewOrders = admin.role === "owner" || admin.role === "orders";
  const canViewReports = admin.role === "owner" || admin.role === "reports";
  const [allProducts, users, allOrders] = await Promise.all([
    canViewProducts || canViewReports ? listProductsFromDatabase() : Promise.resolve([]),
    canViewReports ? listUsers() : Promise.resolve([]),
    canViewOrders || canViewReports ? listOrdersFromDatabase() : Promise.resolve([]),
  ]);
  const activeOrders = allOrders.filter((order) => order.status !== "لغو شده");
  const paidOrders = activeOrders.filter((order) => order.status !== "در انتظار پرداخت");
  const revenue = activeOrders.reduce((sum, order) => sum + order.totals.total, 0);
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.totals.total, 0);
  const reportDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - (6 - index));
    const date = day.toISOString().slice(0, 10);
    const orders = paidOrders.filter((order) => order.date.slice(0, 10) === date);
    return { date, revenue: orders.reduce((sum, order) => sum + order.totals.total, 0), orders: orders.length };
  });
  const reports = {
    paidRevenue: canViewReports ? paidRevenue : 0,
    pendingOrders: canViewReports ? allOrders.filter((order) => order.status === "در انتظار پرداخت").length : 0,
    deliveredOrders: canViewReports ? allOrders.filter((order) => order.status === "تحویل شده").length : 0,
    cancelledOrders: canViewReports ? allOrders.filter((order) => order.status === "لغو شده").length : 0,
    averageOrder: canViewReports && paidOrders.length ? Math.round(paidRevenue / paidOrders.length) : 0,
    salesLast7Days: canViewReports ? reportDays : [],
    topProducts: canViewReports ? allProducts.map((product) => ({ id: product.id, name: product.name, stock: product.stock, sold: paidOrders.reduce((sum, order) => sum + order.items.filter((item) => item.id === product.id).reduce((count, item) => count + item.quantity, 0), 0) })).filter((product) => product.sold > 0).sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name)).slice(0, 10) : [],
  };
  const customers = canViewReports ? users.map((user) => ({ ...user, orders: allOrders.filter((order) => order.userId === user.id).length, totalSpent: paidOrders.filter((order) => order.userId === user.id).reduce((sum, order) => sum + order.totals.total, 0) })) : [];
  res.json({
    role: admin.role,
    products: canViewProducts ? allProducts : [],
    orders: canViewOrders ? allOrders : [],
    customers,
    reports,
    stats: { products: allProducts.length, orders: allOrders.length, revenue, customers: customers.length },
  });
}

export async function adminCustomerOrders(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner", "reports"]);
  if (!admin) return;
  const parsed = adminCustomerIdSchema.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ message: "شناسه مشتری معتبر نیست." });
  const customer = await findUserById(parsed.data);
  if (!customer) return res.status(404).json({ message: "مشتری پیدا نشد." });
  await releaseExpiredOrders();
  res.json({ orders: await listCustomerOrderSummaries(parsed.data) });
}

export async function adminUpdateOrderStatus(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner", "orders"]);
  if (!admin) return;
  const parsed = orderUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات ویرایش سفارش معتبر نیست." });
  const orderId = String(req.params.id);
  let order;
  try {
    order = await updateOrderInDatabase(orderId, parsed.data);
  } catch (error) {
    if (error instanceof InvalidOrderTransitionError) return res.status(409).json({ message: "انتقال وضعیت سفارش از مرحله فعلی مجاز نیست." });
    throw error;
  }
  if (!order) return res.status(404).json({ message: "سفارش پیدا نشد." });
  await recordAdminActivity({ adminUserId: admin.id, action: "order.update", entityType: "order", entityId: orderId, metadata: parsed.data });
  if (parsed.data.status) dispatchUserNotification({ userId: order.userId, title: `وضعیت سفارش ${order.id}`, text: `وضعیت سفارش شما: ${parsed.data.status}` });
  res.json({ order });
}

export async function adminUpdateStock(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner", "products"]);
  if (!admin) return;
  const parsed = stockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "مقدار موجودی معتبر نیست." });
  const productId = Number(req.params.id);
  const product = await setProductStockInDatabase(productId, parsed.data.stock);
  if (!product) return res.status(404).json({ message: "محصول پیدا نشد." });
  await recordAdminActivity({ adminUserId: admin.id, action: "product.stock.update", entityType: "product", entityId: String(productId), metadata: { stock: parsed.data.stock } });
  res.json({ product });
}

export async function adminCreateProduct(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner", "products"]);
  if (!admin) return;
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات محصول کامل یا معتبر نیست." });
  const product = await createProductInDatabase(parsed.data as Omit<Product, "id">);
  await recordAdminActivity({ adminUserId: admin.id, action: "product.create", entityType: "product", entityId: String(product.id) });
  res.status(201).json({ product });
}

export async function adminUpdateProduct(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner", "products"]);
  if (!admin) return;
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "اطلاعات محصول معتبر نیست." });
  const productId = Number(req.params.id);
  const product = await updateProductInDatabase(productId, parsed.data);
  if (!product) return res.status(404).json({ message: "محصول پیدا نشد." });
  await recordAdminActivity({ adminUserId: admin.id, action: "product.update", entityType: "product", entityId: String(productId), metadata: parsed.data });
  res.json({ product });
}

export async function adminDeleteProduct(req: Request, res: Response) {
  const admin = await requireAdmin(req, res, ["owner", "products"]);
  if (!admin) return;
  const productId = Number(req.params.id);
  const product = await deactivateProductInDatabase(productId);
  if (!product) return res.status(404).json({ message: "محصول پیدا نشد." });
  await recordAdminActivity({ adminUserId: admin.id, action: "product.deactivate", entityType: "product", entityId: String(productId) });
  res.json({ product });
}
