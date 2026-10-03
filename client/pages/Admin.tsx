import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BarChart3, ChevronLeft, ChevronRight, FileText, LockKeyhole, LogOut, PackageCheck, Pencil, Save, Search, Sparkles, Store, Trash2, UserRound, Users, X } from "lucide-react";
import AdminAccessPanel from "@/components/AdminAccessPanel";
import { toast } from "sonner";

type AdminRole = "owner" | "orders" | "products" | "reports";
type Product = { id: number; name: string; category: string; weight: number; karat: number; price: number; image: string; description: string; tag?: string; stock: number; active: boolean };
type Order = { id: string; userId: string; date: string; status: string; tracking: string; note?: string; items: Array<{ id?: number; name: string; quantity: number; price: number; customization?: string }>; address: { title: string; receiver: string; phone: string; details: string; postalCode: string }; totals: { base: number; making: number; profit: number; tax: number; shipping: number; insurance: number; customization: number; total: number } };
type Customer = { id: string; name: string; identifier: string; joinedAt: string; orders: number; totalSpent: number };
type CustomerOrderSummary = { id: string; date: string; status: string; total: number };
type AccessInfo = { admins: Array<{ id: string; name: string; identifier: string | null; role: string; roleTitle: string; active: boolean }>; roles: Record<string, { title: string; permissions: readonly string[] }> };
type Overview = { role: AdminRole; products: Product[]; orders: Order[]; customers: Customer[]; reports: { paidRevenue: number; pendingOrders: number; deliveredOrders: number; cancelledOrders: number; averageOrder: number; salesLast7Days: Array<{ date: string; revenue: number; orders: number }>; topProducts: Array<{ id: number; name: string; stock: number; sold: number }> }; stats: { products: number; orders: number; revenue: number; customers: number } };
type ProductForm = { name: string; category: string; weight: string; karat: string; price: string; image: string; description: string; tag: string; stock: string; active: boolean };
type Tab = "overview" | "orders" | "products" | "reports" | "customers" | "access";
type Notice = { text: string; tone: "success" | "error" };

const statuses = ["در انتظار پرداخت", "پرداخت شده", "در حال آماده‌سازی", "آماده ارسال", "ارسال شده", "تحویل شده", "لغو شده"];
const emptyForm: ProductForm = { name: "", category: "انگشتر", weight: "1", karat: "18", price: "0", image: "", description: "", tag: "", stock: "0", active: true };
const pageSize = 8;
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const date = (value: string) => new Date(value).toLocaleDateString("fa-IR");

function Pagination({ page, total, count, onChange }: { page: number; total: number; count: number; onChange: (page: number) => void }) {
  if (!count) return null;
  return <div className="flex flex-wrap items-center justify-center gap-3 pt-4"><button disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border border-[#dfd5c7] p-2 text-[#756b5e] disabled:opacity-40" aria-label="صفحه قبل"><ChevronRight size={16} /></button><span className="text-xs text-[#817769]">نمایش {number((page - 1) * pageSize + 1)} تا {number(Math.min(page * pageSize, count))} از {number(count)} · صفحه {number(page)} از {number(total)}</span><button disabled={page >= total} onClick={() => onChange(page + 1)} className="rounded-lg border border-[#dfd5c7] p-2 text-[#756b5e] disabled:opacity-40" aria-label="صفحه بعد"><ChevronLeft size={16} /></button></div>;
}

function downloadCsv(rows: Array<Array<string | number>>) {
  const escapeCell = (value: string | number) => {
    const text = String(value);
    const safeText = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const content = `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "zarinsa-admin-report.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Admin() {
  const [key, setKey] = useState(() => import.meta.env.DEV ? "zarinsa-admin-dev" : "");
  const [identifier, setIdentifier] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderSummary[]>([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("همه وضعیت‌ها");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});
  const [orderPage, setOrderPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const headers = { "x-admin-key": key };
  const notify = (text: string, tone: Notice["tone"]) => {
    setNotice({ text, tone });
    tone === "success" ? toast.success(text) : toast.error(text);
  };

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/overview", { headers, credentials: "include" });
      const data = await response.json() as Partial<Overview> & { message?: string };
      if (!response.ok || !data.role) {
        setOverview(null);
        setRole(null);
        setAccess(null);
        notify(data.message ?? "دسترسی رد شد.", "error");
        return;
      }
      setOverview(data as Overview);
      setRole(data.role);
      setKey("");
      setIdentifier("");
      if (data.role === "owner") {
        const accessResponse = await fetch("/api/admin/access", { headers, credentials: "include" });
        if (accessResponse.ok) setAccess(await accessResponse.json() as AccessInfo);
      } else {
        setAccess(null);
      }
      setNotice(null);
    } catch {
      notify("ارتباط با سرویس مدیریت برقرار نشد.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    sessionStorage.removeItem("zarinsa-admin-key");
    sessionStorage.removeItem("zarinsa-admin-identifier");
    void load();
  }, []);

  const tabs = useMemo(() => {
    const result: Array<{ id: Tab; label: string }> = [{ id: "overview", label: "نمای کلی" }];
    if (role === "owner" || role === "orders") result.push({ id: "orders", label: "سفارش‌ها" });
    if (role === "owner" || role === "products") result.push({ id: "products", label: "محصولات و موجودی" });
    if (role === "owner" || role === "reports") result.push({ id: "reports", label: "گزارش‌ها" }, { id: "customers", label: "مشتریان" });
    if (role === "owner") result.push({ id: "access", label: "کاربران و دسترسی" });
    return result;
  }, [role]);

  useEffect(() => {
    if (role && !tabs.some((item) => item.id === tab)) setTab("overview");
  }, [role, tab, tabs]);

  const login = async () => {
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ key, ...(identifier ? { identifier } : {}) }) });
      const data = await response.json() as { message?: string };
      if (!response.ok) {
        notify(data.message ?? "ورود مدیریت ناموفق بود.", "error");
        return;
      }
      toast.success("ورود مدیریت موفق بود.");
      await load();
    } catch {
      notify("ارتباط با سرویس ورود مدیریت برقرار نشد.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST", headers, credentials: "include" });
    setOverview(null);
    setAccess(null);
    setRole(null);
    setSelectedCustomerId(null);
    notify("از پنل مدیریت خارج شدید.", "success");
  };

  const updateStatus = async (id: string, status: string) => {
    setSubmitting(true);
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status }) });
    const data = await response.json() as { message?: string };
    setSubmitting(false);
    if (!response.ok) {
      notify(data.message ?? "وضعیت سفارش بروزرسانی نشد.", "error");
      return;
    }
    notify("وضعیت سفارش بروزرسانی شد.", "success");
    await load();
  };

  const saveOrderOperational = async () => {
    if (!selectedOrderId) return;
    setSubmitting(true);
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(selectedOrderId)}/status`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ tracking: trackingDraft, note: noteDraft }) });
    const data = await response.json() as { message?: string };
    setSubmitting(false);
    if (!response.ok) {
      notify(data.message ?? "اطلاعات عملیاتی ذخیره نشد.", "error");
      return;
    }
    notify("اطلاعات عملیاتی سفارش ذخیره شد.", "success");
    await load();
  };

  const selectOrder = (order: Order) => {
    setSelectedOrderId(order.id);
    setTrackingDraft(order.tracking);
    setNoteDraft(order.note ?? "");
  };

  const saveProduct = async () => {
    const payload = { ...form, weight: Number(form.weight), karat: Number(form.karat), price: Number(form.price), stock: Number(form.stock) };
    setSubmitting(true);
    const response = await fetch(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", { method: editingId ? "PATCH" : "POST", headers: { ...headers, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const data = await response.json() as { message?: string };
    setSubmitting(false);
    if (!response.ok) {
      notify(data.message ?? "ذخیره محصول انجام نشد.", "error");
      return;
    }
    notify(editingId ? "محصول ویرایش شد." : "محصول جدید ایجاد شد.", "success");
    setEditingId(null);
    setForm(emptyForm);
    await load();
  };

  const updateStock = async (product: Product) => {
    const stock = Number(stockDrafts[product.id] ?? product.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      notify("موجودی باید یک عدد صحیح مثبت یا صفر باشد.", "error");
      return;
    }
    const response = await fetch(`/api/admin/products/${product.id}/stock`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ stock }) });
    const data = await response.json() as { message?: string };
    if (!response.ok) {
      notify(data.message ?? "موجودی بروزرسانی نشد.", "error");
      return;
    }
    notify("موجودی محصول بروزرسانی شد.", "success");
    await load();
  };

  const editProduct = (product: Product) => {
    setEditingId(product.id);
    setForm({ name: product.name, category: product.category, weight: String(product.weight), karat: String(product.karat), price: String(product.price), image: product.image, description: product.description, tag: product.tag ?? "", stock: String(product.stock), active: product.active });
    setTab("products");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteProduct = async (id: number) => {
    if (!window.confirm("محصول از فروشگاه غیرفعال شود؟")) return;
    const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE", headers, credentials: "include" });
    const data = await response.json() as { message?: string };
    if (!response.ok) {
      notify(data.message ?? "غیرفعال‌سازی محصول انجام نشد.", "error");
      return;
    }
    notify("محصول غیرفعال شد.", "success");
    await load();
  };

  const filteredOrders = useMemo(() => {
    if (!overview) return [];
    const query = orderQuery.trim().toLowerCase();
    return overview.orders.filter((order) => {
      const matchesQuery = !query || order.id.toLowerCase().includes(query) || order.tracking.includes(query) || order.items.some((item) => item.name.toLowerCase().includes(query));
      return (orderStatus === "همه وضعیت‌ها" || order.status === orderStatus) && matchesQuery;
    });
  }, [overview, orderQuery, orderStatus]);
  const filteredCustomers = useMemo(() => overview?.customers.filter((customer) => customer.name.includes(customerQuery) || customer.identifier.toLowerCase().includes(customerQuery.toLowerCase())) ?? [], [overview, customerQuery]);
  const visibleOrders = filteredOrders.slice((orderPage - 1) * pageSize, orderPage * pageSize);
  const visibleCustomers = filteredCustomers.slice((customerPage - 1) * pageSize, customerPage * pageSize);
  const visibleProducts = overview?.products.slice((productPage - 1) * pageSize, productPage * pageSize) ?? [];
  const selectedCustomerOrders = customerOrders;

  useEffect(() => { setOrderPage(1); }, [orderQuery, orderStatus]);
  useEffect(() => { setCustomerPage(1); setSelectedCustomerId(null); }, [customerQuery]);
  useEffect(() => { setOrderPage((page) => Math.min(page, Math.max(1, Math.ceil(filteredOrders.length / pageSize)))); }, [filteredOrders.length]);
  useEffect(() => { setCustomerPage((page) => Math.min(page, Math.max(1, Math.ceil(filteredCustomers.length / pageSize)))); }, [filteredCustomers.length]);
  useEffect(() => { setProductPage((page) => Math.min(page, Math.max(1, Math.ceil((overview?.products.length ?? 0) / pageSize)))); }, [overview?.products.length]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerOrders([]);
      setCustomerOrdersLoading(false);
      return;
    }
    let active = true;
    setCustomerOrders([]);
    setCustomerOrdersLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/admin/customers/${encodeURIComponent(selectedCustomerId)}/orders`, { headers, credentials: "include" });
        const data = await response.json() as { orders?: CustomerOrderSummary[]; message?: string };
        if (!response.ok) throw new Error(data.message ?? "دریافت سابقه سفارش مشتری انجام نشد.");
        if (active) setCustomerOrders(data.orders ?? []);
      } catch {
        if (active) notify("دریافت سابقه سفارش مشتری انجام نشد.", "error");
      } finally {
        if (active) setCustomerOrdersLoading(false);
      }
    })();
    return () => { active = false; };
  }, [selectedCustomerId]);

  return <main dir="rtl" className="min-h-screen bg-[#f7f4ef] text-[#29251f]">
    <header className="border-b border-[#e6dfd4] bg-[#302b24] text-white"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8"><Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b89145]"><Sparkles size={19} /></span><span><span className="block font-serif text-xl font-bold">زرین‌سا</span><span className="block text-[10px] tracking-[0.18em] text-[#d5b879]">ADMIN CONSOLE</span></span></Link><div className="flex items-center gap-4"><Link to="/" className="text-sm text-[#d5c8b8]">بازگشت به فروشگاه</Link>{overview && <button onClick={() => void logout()} className="flex items-center gap-1 text-sm text-[#d5c8b8]"><LogOut size={15} /> خروج</button>}</div></div></header>
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm text-[#a47b32]">مدیریت زرین‌سا</p><h1 className="font-serif text-3xl font-bold sm:text-4xl">داشبورد مدیریت</h1>{role && <p className="mt-2 text-xs text-[#817769]">سطح دسترسی: {access?.roles[role]?.title ?? (role === "owner" ? "مدیر ارشد" : role)}</p>}</div><div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e3d9cb] bg-white px-3 py-2"><LockKeyhole size={15} className="text-[#a47b32]" /><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="w-32 bg-transparent text-xs outline-none" placeholder="شناسه مدیر" dir="ltr" /><input value={key} onChange={(event) => setKey(event.target.value)} className="w-40 bg-transparent text-xs outline-none" placeholder="کلید مدیریت" dir="ltr" type="password" /><button disabled={submitting} onClick={() => void login()} className="rounded-lg bg-[#302b24] px-3 py-1.5 text-xs text-white disabled:opacity-50">ورود</button></div></div>
      {notice && <div className={`mb-5 rounded-xl p-3 text-sm ${notice.tone === "success" ? "bg-[#edf7ef] text-[#4d8c63]" : "bg-[#fff3ed] text-[#a55b4b]"}`}>{notice.text}</div>}
      {loading ? <div className="rounded-3xl bg-white p-16 text-center text-sm text-[#817769]">در حال دریافت اطلاعات مدیریت...</div> : !overview ? <div className="rounded-3xl border border-dashed border-[#d8cbb8] bg-white p-16 text-center"><LockKeyhole className="mx-auto mb-4 text-[#b89145]" size={36} /><p className="text-sm text-[#817769]">برای مشاهده داشبورد، کلید مدیریت را وارد کنید.</p></div> : <>
        <nav className="mb-7 flex gap-2 overflow-x-auto pb-1">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-sm ${tab === item.id ? "bg-[#302b24] text-white" : "bg-white text-[#756b5e]"}`}>{item.label}</button>)}</nav>
        {tab === "overview" && <section className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-[#302b24] p-5 text-white"><BarChart3 className="mb-5 text-[#d5b879]" size={22} /><p className="text-xs text-[#c4b8a9]">مجموع فروش ثبت‌شده</p><p className="mt-2 text-xl font-bold">{number(overview.stats.revenue)} تومان</p></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><PackageCheck className="mb-5 text-[#b89145]" size={22} /><p className="text-xs text-[#817769]">تعداد سفارش‌ها</p><p className="mt-2 text-xl font-bold">{number(overview.stats.orders)}</p></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><Store className="mb-5 text-[#b89145]" size={22} /><p className="text-xs text-[#817769]">محصولات فعال</p><p className="mt-2 text-xl font-bold">{number(overview.stats.products)}</p></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><Users className="mb-5 text-[#b89145]" size={22} /><p className="text-xs text-[#817769]">مشتریان</p><p className="mt-2 text-xl font-bold">{number(overview.stats.customers)}</p></div></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><h2 className="mb-4 font-medium">دسترسی سریع</h2><div className="grid gap-2 sm:grid-cols-2">{tabs.filter((item) => item.id !== "overview").map((item) => <button key={item.id} onClick={() => setTab(item.id)} className="flex items-center justify-between rounded-xl bg-[#fcfaf7] px-4 py-3 text-sm text-[#756b5e]">{item.label}<ChevronLeft size={16} /></button>)}</div></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><h2 className="mb-4 font-medium">وضعیت عملیاتی</h2><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[#fff8e9] p-3"><p className="text-xs text-[#8b682e]">در انتظار پرداخت</p><strong className="mt-2 block">{number(overview.reports.pendingOrders)}</strong></div><div className="rounded-xl bg-[#edf7ef] p-3"><p className="text-xs text-[#4d8c63]">تحویل‌شده</p><strong className="mt-2 block">{number(overview.reports.deliveredOrders)}</strong></div><div className="rounded-xl bg-[#f4f0e9] p-3"><p className="text-xs text-[#817769]">مشتری فعال</p><strong className="mt-2 block">{number(overview.stats.customers)}</strong></div></div></div></div></section>}
        {tab === "reports" && <section className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium">گزارش‌های فروش</h2><p className="mt-1 text-xs text-[#817769]">خلاصه فروش و عملکرد هفت روز اخیر</p></div><button onClick={() => downloadCsv([["گزارش", "مقدار"], ["فروش پرداخت‌شده (تومان)", overview.reports.paidRevenue], ["میانگین سفارش (تومان)", overview.reports.averageOrder], ["در انتظار پرداخت", overview.reports.pendingOrders], ["تحویل‌شده", overview.reports.deliveredOrders], ["لغوشده", overview.reports.cancelledOrders], [], ["تاریخ", "فروش پرداخت‌شده (تومان)", "تعداد سفارش"], ...overview.reports.salesLast7Days.map((day) => [day.date, day.revenue, day.orders]), [], ["محصول", "تعداد فروش", "موجودی"], ...overview.reports.topProducts.map((product) => [product.name, product.sold, product.stock])])} className="flex items-center gap-2 rounded-xl bg-[#302b24] px-4 py-2.5 text-sm text-white"><FileText size={16} /> دریافت گزارش CSV</button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-2xl bg-[#302b24] p-5 text-white"><p className="text-xs text-[#c4b8a9]">فروش پرداخت‌شده</p><p className="mt-2 text-xl font-bold">{number(overview.reports.paidRevenue)} تومان</p></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><p className="text-xs text-[#817769]">میانگین سفارش</p><p className="mt-2 text-xl font-bold">{number(overview.reports.averageOrder)} تومان</p></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><p className="text-xs text-[#817769]">در انتظار پرداخت</p><p className="mt-2 text-xl font-bold">{number(overview.reports.pendingOrders)}</p></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><p className="text-xs text-[#817769]">تحویل‌شده</p><p className="mt-2 text-xl font-bold">{number(overview.reports.deliveredOrders)}</p></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><p className="text-xs text-[#817769]">لغوشده</p><p className="mt-2 text-xl font-bold">{number(overview.reports.cancelledOrders)}</p></div></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><h2 className="mb-5 flex items-center gap-2 font-medium"><BarChart3 size={18} className="text-[#b89145]" /> روند فروش هفت روز اخیر</h2><div className="space-y-4">{overview.reports.salesLast7Days.map((day) => <div key={day.date} className="grid grid-cols-[76px_1fr] items-center gap-3 text-xs sm:grid-cols-[100px_1fr]"><span className="text-[#817769]">{date(day.date)}</span><div><div className="h-2 overflow-hidden rounded-full bg-[#f0ebe3]"><div className="h-full rounded-full bg-[#b89145]" style={{ width: `${Math.max(day.revenue ? 3 : 0, day.revenue / Math.max(...overview.reports.salesLast7Days.map((item) => item.revenue), 1) * 100)}%` }} /></div><p className="mt-1 text-[#756b5e]">{number(day.revenue)} تومان · {number(day.orders)} سفارش</p></div></div>)}</div></div><div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><h2 className="mb-5 flex items-center gap-2 font-medium"><BarChart3 size={18} className="text-[#b89145]" /> عملکرد محصولات</h2><div className="space-y-3">{overview.reports.topProducts.map((product) => <div key={product.id} className="flex items-center justify-between rounded-xl bg-[#fcfaf7] p-4 text-sm"><span>{product.name}</span><span className="text-[#8b682e]">فروش: {number(product.sold)} · موجودی: {number(product.stock)}</span></div>)}</div></div></section>}
        {tab === "customers" && <section className="space-y-4"><div className="flex items-center gap-3 rounded-2xl border border-[#e9e0d4] bg-white p-4"><Search size={18} className="text-[#a28e71]" /><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="جستجوی نام، موبایل یا ایمیل مشتری" className="w-full bg-transparent text-sm outline-none" /></div>{visibleCustomers.length === 0 ? <div className="rounded-2xl bg-white p-12 text-center text-sm text-[#958a7b]">مشتری‌ای پیدا نشد.</div> : <div className="space-y-3">{visibleCustomers.map((customer) => <article key={customer.id} className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-medium">{customer.name}</h2><p className="mt-1 text-sm text-[#817769]" dir="ltr">{customer.identifier}</p><p className="mt-2 text-xs text-[#958a7b]">عضویت: {date(customer.joinedAt)}</p></div><div className="flex items-center gap-6 text-left text-sm"><div><p className="text-xs text-[#817769]">سفارش‌ها</p><strong>{number(customer.orders)}</strong></div><div><p className="text-xs text-[#817769]">مجموع خرید</p><strong className="text-[#8b682e]">{number(customer.totalSpent)} تومان</strong></div><button onClick={() => setSelectedCustomerId(selectedCustomerId === customer.id ? null : customer.id)} className="rounded-lg border border-[#dfd5c7] p-2 text-[#8b682e]" title="جزئیات مشتری"><ChevronLeft size={16} /></button></div></div>{selectedCustomerId === customer.id && <div className="mt-5 border-t border-[#eee7de] pt-4 text-sm"><p className="mb-3 font-medium">خلاصه مشتری</p><p className="leading-7 text-[#756b5e]">شناسه داخلی: {customer.id}</p><p className="leading-7 text-[#756b5e]">تعداد سفارش‌های ثبت‌شده: {number(customer.orders)}</p><p className="leading-7 text-[#756b5e]">مجموع خرید غیرلغوشده: {number(customer.totalSpent)} تومان</p>{customerOrdersLoading ? <p className="mt-2 text-xs text-[#958a7b]">در حال دریافت سفارش‌های مشتری...</p> : selectedCustomerOrders.length > 0 ? <div className="mt-3 space-y-2"><p className="text-xs text-[#817769]">سفارش‌های این مشتری</p>{selectedCustomerOrders.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"><span>{order.id} · {order.status} · {date(order.date)}</span><span className="text-[#8b682e]">{number(order.total)} تومان</span></div>)}</div> : <p className="mt-2 text-xs text-[#958a7b]">این مشتری هنوز سفارشی ثبت نکرده است.</p>}</div>}</article>)}</div>}<Pagination page={customerPage} total={Math.max(1, Math.ceil(filteredCustomers.length / pageSize))} count={filteredCustomers.length} onChange={setCustomerPage} /></section>}
        {tab === "orders" && <section className="space-y-5"><div className="grid gap-3 rounded-2xl border border-[#e9e0d4] bg-white p-4 sm:grid-cols-[1fr_220px]"><div className="flex items-center gap-3 rounded-xl border border-[#dfd5c7] px-3"><Search size={17} className="text-[#a28e71]" /><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="شماره سفارش، کد رهگیری یا محصول" className="w-full py-2.5 text-sm outline-none" /></div><select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} className="rounded-xl border border-[#dfd5c7] bg-white px-3 py-2.5 text-sm outline-none"><option>همه وضعیت‌ها</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>{visibleOrders.length === 0 ? <div className="rounded-2xl bg-white p-12 text-center text-sm text-[#958a7b]">سفارشی پیدا نشد.</div> : <div className="space-y-3">{visibleOrders.map((order) => <article key={order.id} className={`rounded-2xl border bg-white p-5 ${selectedOrderId === order.id ? "border-[#b89145]" : "border-[#e9e0d4]"}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{order.id}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] ${order.status === "لغو شده" ? "bg-[#fff0ed] text-[#a55b4b]" : order.status === "تحویل شده" ? "bg-[#eaf6ee] text-[#4c9062]" : "bg-[#f8f0df] text-[#956f2d]"}`}>{order.status}</span></div><p className="mt-2 text-xs text-[#817769]">{date(order.date)} · {order.address.receiver} · {order.items.map((item) => item.name).join("، ")}</p></div><strong className="text-[#8b682e]">{number(order.totals.total)} تومان</strong></div><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#eee7de] pt-4"><button onClick={() => selectOrder(order)} className="flex items-center gap-1 rounded-lg bg-[#302b24] px-3 py-2 text-xs text-white"><FileText size={14} /> جزئیات و عملیات</button><select value={order.status} disabled={submitting} onChange={(event) => void updateStatus(order.id, event.target.value)} className="rounded-lg border border-[#dfd5c7] bg-white px-2 py-2 text-xs outline-none">{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>{selectedOrderId === order.id && <div className="mt-5 grid gap-4 border-t border-[#eee7de] pt-5 lg:grid-cols-[1.1fr_.9fr]"><div><h3 className="mb-3 font-medium">اقلام سفارش</h3><div className="space-y-2">{order.items.map((item, index) => <div key={`${item.name}-${index}`} className="rounded-xl bg-[#fcfaf7] p-3 text-xs"><div className="flex justify-between gap-3"><span>{item.name} · تعداد {number(item.quantity)}</span><strong>{number(item.price * item.quantity)} تومان</strong></div>{item.customization && <p className="mt-1 text-[#a47b32]">{item.customization}</p>}</div>)}</div><div className="mt-4 rounded-xl bg-[#fcfaf7] p-3 text-xs leading-6 text-[#756b5e]"><p>گیرنده: {order.address.receiver} · {order.address.phone}</p><p>{order.address.details} · کد پستی: {order.address.postalCode}</p></div></div><div className="rounded-xl bg-[#fcfaf7] p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-medium">اطلاعات ارسال</h3><button onClick={() => setSelectedOrderId(null)} className="text-[#958a7b]" aria-label="بستن جزئیات"><X size={16} /></button></div><label className="block text-xs text-[#817769]">کد رهگیری<input value={trackingDraft} onChange={(event) => setTrackingDraft(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dfd5c7] bg-white px-3 py-2 text-sm outline-none" dir="ltr" /></label><label className="mt-3 block text-xs text-[#817769]">یادداشت داخلی<textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-[#dfd5c7] bg-white px-3 py-2 text-sm outline-none" /></label><button disabled={submitting} onClick={() => void saveOrderOperational()} className="mt-3 flex items-center gap-2 rounded-lg bg-[#b89145] px-3 py-2.5 text-xs text-white disabled:opacity-50"><Save size={14} /> ذخیره اطلاعات</button><div className="mt-4 flex flex-wrap gap-2 text-xs"><Link to={`/invoice/${encodeURIComponent(order.id)}`} className="text-[#8b682e]">فاکتور</Link><Link to={`/track/${encodeURIComponent(order.tracking)}`} className="text-[#8b682e]">رهگیری</Link></div></div></div>}</article>)}</div>}<Pagination page={orderPage} total={Math.max(1, Math.ceil(filteredOrders.length / pageSize))} count={filteredOrders.length} onChange={setOrderPage} /></section>}
        {tab === "products" && <section className="space-y-6"><section className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><div className="mb-5 flex items-start justify-between"><div><h2 className="font-medium">{editingId ? "ویرایش محصول" : "افزودن محصول جدید"}</h2><p className="mt-1 text-xs text-[#958a7b]">وزن، عیار، قیمت پایه و موجودی را دقیق ثبت کنید.</p></div>{editingId && <button onClick={() => { setEditingId(null); setForm(emptyForm); }} className="flex items-center gap-1 text-xs text-[#a55b4b]"><X size={14} /> لغو ویرایش</button>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="نام محصول" className="rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="دسته‌بندی" className="rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /><label className="text-xs text-[#70675b]">وزن محصول (گرم)<input value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} type="number" step="0.01" className="mt-2 w-full rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /></label><label className="text-xs text-[#70675b]">عیار طلا<input value={form.karat} onChange={(event) => setForm({ ...form, karat: event.target.value })} type="number" className="mt-2 w-full rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /></label><label className="text-xs text-[#70675b]">قیمت پایه (تومان)<input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} type="number" className="mt-2 w-full rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /></label><label className="text-xs text-[#70675b]">موجودی اولیه<input value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} type="number" className="mt-2 w-full rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /></label><input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="آدرس تصویر https://..." dir="ltr" className="rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-left text-sm outline-none" /><input value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })} placeholder="برچسب اختیاری" className="rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="توضیحات محصول" rows={3} className="rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none sm:col-span-2 lg:col-span-4" /><label className="flex items-center gap-2 text-xs text-[#70675b]"><input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" /> نمایش محصول در فروشگاه</label></div><button disabled={submitting} onClick={() => void saveProduct()} className="mt-4 flex items-center gap-2 rounded-xl bg-[#302b24] px-4 py-3 text-sm text-white disabled:opacity-50"><Save size={16} /> {submitting ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "ایجاد محصول"}</button></section><section className="space-y-3">{visibleProducts.map((product) => <article key={product.id} className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-4"><img src={product.image} alt={product.name} className="h-20 w-20 rounded-xl object-cover" /><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{product.name}</h2><span className={`rounded-full px-2 py-1 text-[10px] ${product.active ? "bg-[#eaf5ed] text-[#4e9b6b]" : "bg-[#f8e9e5] text-[#a55b4b]"}`}>{product.active ? "فعال" : "غیرفعال"}</span></div><p className="mt-2 text-xs text-[#817769]">{product.category} · {product.weight} گرم · عیار {product.karat} · قیمت پایه {number(product.price)} تومان</p></div></div><div className="flex items-center gap-2"><button onClick={() => editProduct(product)} className="rounded-lg border border-[#dfd5c7] p-2 text-[#8b682e]" title="ویرایش"><Pencil size={15} /></button><button onClick={() => void deleteProduct(product.id)} className="rounded-lg border border-[#eed6d0] p-2 text-[#a55b4b]" title="غیرفعال‌سازی"><Trash2 size={15} /></button></div></div><div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#eee7de] pt-4"><label className="text-xs text-[#817769]">موجودی فعلی<input value={stockDrafts[product.id] ?? String(product.stock)} onChange={(event) => setStockDrafts({ ...stockDrafts, [product.id]: event.target.value })} type="number" min="0" className="mt-2 w-28 rounded-lg border border-[#dfd5c7] px-3 py-2 text-sm outline-none" /></label><button onClick={() => void updateStock(product)} className="flex items-center gap-1 rounded-lg bg-[#b89145] px-3 py-2.5 text-xs text-white"><Save size={14} /> ذخیره موجودی</button><span className="text-xs text-[#958a7b]">فروش ثبت‌شده: {number(overview.reports.topProducts.find((item) => item.name === product.name)?.sold ?? 0)} عدد</span></div></article>)}<Pagination page={productPage} total={Math.max(1, Math.ceil(overview.products.length / pageSize))} count={overview.products.length} onChange={setProductPage} /></section></section>}
        {tab === "access" && access && <AdminAccessPanel access={access} headers={headers} onChanged={load} />}
      </>}</div>
    <footer className="border-t border-[#e9e0d4] px-5 py-8 text-center text-xs text-[#948a7d]">پنل مدیریت زرین‌سا · دسترسی محدود و ثبت فعالیت‌ها</footer>
  </main>;
}
