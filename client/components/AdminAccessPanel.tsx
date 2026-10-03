import { useEffect, useState } from "react";
import { Activity, KeyRound, Pencil, Plus, ShieldCheck, UserX } from "lucide-react";

type RoleInfo = { title: string; permissions: readonly string[] };
type Admin = { id: string; name: string; identifier: string | null; role: string; roleTitle: string; active: boolean };
type AccessInfo = { admins: Admin[]; roles: Record<string, RoleInfo> };
type ActivityItem = { id: number; adminName: string | null; action: string; entityType: string | null; entityId: string | null; createdAt: string };
type Props = { access: AccessInfo; headers: Record<string, string>; onChanged: () => Promise<void> };
type Form = { name: string; identifier: string; key: string; role: string };

const emptyForm: Form = { name: "", identifier: "", key: "", role: "orders" };
const actionLabels: Record<string, string> = { "admin.login": "ورود به پنل", "admin.logout": "خروج از پنل", "admin.create": "ایجاد مدیر", "admin.update": "ویرایش مدیر", "admin.deactivate": "غیرفعال‌سازی مدیر", "order.update": "ویرایش سفارش", "product.create": "ایجاد محصول", "product.update": "ویرایش محصول", "product.deactivate": "غیرفعال‌سازی محصول", "product.stock.update": "ویرایش موجودی" };

export default function AdminAccessPanel({ access, headers, onChanged }: Props) {
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadActivity = async () => {
    const response = await fetch("/api/admin/activity", { headers, credentials: "include" });
    if (response.ok) setActivity((await response.json()).activity ?? []);
  };
  useEffect(() => { void loadActivity(); }, []);

  const submit = async () => {
    if (!form.name || !form.identifier || (!editingId && !form.key)) { setNotice("نام، شناسه و کلید مدیر را کامل کنید."); return; }
    setSaving(true);
    setNotice("");
    const payload = { name: form.name, identifier: form.identifier, role: form.role, ...(form.key ? { key: form.key } : {}) };
    const response = await fetch(editingId ? `/api/admin/users/${editingId}` : "/api/admin/users", { method: editingId ? "PATCH" : "POST", headers: { ...headers, "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setNotice(data.message ?? "ذخیره مدیر انجام نشد."); return; }
    setNotice(editingId ? "اطلاعات مدیر بروزرسانی شد." : "مدیر جدید ایجاد شد.");
    setForm(emptyForm);
    setEditingId(null);
    await onChanged();
    await loadActivity();
  };

  const edit = (admin: Admin) => {
    setEditingId(admin.id);
    setForm({ name: admin.name, identifier: admin.identifier ?? "", key: "", role: admin.role });
  };

  const deactivate = async (id: string) => {
    const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE", headers, credentials: "include" });
    const data = await response.json();
    if (!response.ok) { setNotice(data.message ?? "غیرفعال‌سازی مدیر انجام نشد."); return; }
    setNotice("مدیر غیرفعال شد.");
    await onChanged();
    await loadActivity();
  };

  return <section className="space-y-6">
    <div className="rounded-2xl border border-[#e9e0d4] bg-white p-5">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="font-medium">{editingId ? "ویرایش مدیر" : "افزودن مدیر جدید"}</h2><p className="mt-1 text-xs text-[#958a7b]">کلید ورود هر مدیر فقط به‌صورت hash‌شده در سرور ذخیره می‌شود.</p></div>{editingId ? <button onClick={() => { setEditingId(null); setForm(emptyForm); }} className="text-xs text-[#a55b4b]">لغو ویرایش</button> : <Plus size={19} className="text-[#b89145]" />}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="نام مدیر" className="rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /><input value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} placeholder="شناسه ورود" dir="ltr" className="rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /><input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder={editingId ? "کلید جدید (اختیاری)" : "کلید ورود حداقل ۱۲ کاراکتر"} type="password" dir="ltr" className="rounded-xl border border-[#dfd5c7] px-3 py-2.5 text-sm outline-none" /><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="rounded-xl border border-[#dfd5c7] bg-white px-3 py-2.5 text-sm outline-none">{Object.entries(access.roles).map(([role, info]) => <option key={role} value={role}>{info.title}</option>)}</select></div>
      {notice && <p className="mt-3 text-xs text-[#8b682e]">{notice}</p>}
      <button onClick={() => void submit()} disabled={saving} className="mt-4 flex items-center gap-2 rounded-xl bg-[#302b24] px-4 py-3 text-sm text-white disabled:opacity-50"><KeyRound size={16} />{saving ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "ایجاد مدیر"}</button>
    </div>
    <div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-[#b89145]" /><h2 className="font-medium">مدیران سیستم</h2></div><div className="space-y-3">{access.admins.map((admin) => <div key={admin.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fcfaf7] p-4"><div><p className="font-medium">{admin.name}</p><p className="mt-1 text-xs text-[#817769]" dir="ltr">{admin.identifier ?? admin.id}</p><span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] ${admin.active ? "bg-[#eaf5ed] text-[#4e9b6b]" : "bg-[#f8e9e5] text-[#a55b4b]"}`}>{admin.active ? "فعال" : "غیرفعال"}</span></div><div className="flex items-center gap-2"><span className="rounded-full bg-[#f7efdf] px-3 py-1 text-xs text-[#8b682e]">{admin.roleTitle}</span><button onClick={() => edit(admin)} className="rounded-lg border border-[#dfd5c7] p-2 text-[#8b682e]" title="ویرایش"><Pencil size={15} /></button>{admin.id !== "primary-admin" && admin.active && <button onClick={() => void deactivate(admin.id)} className="rounded-lg border border-[#eed6d0] p-2 text-[#a55b4b]" title="غیرفعال‌سازی"><UserX size={15} /></button>}</div></div>)}</div></div>
    <div className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><div className="mb-4 flex items-center gap-2"><Activity size={18} className="text-[#b89145]" /><h2 className="font-medium">لاگ فعالیت مدیران</h2></div><div className="space-y-2">{activity.length === 0 ? <p className="text-sm text-[#958a7b]">هنوز فعالیتی ثبت نشده است.</p> : activity.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fcfaf7] px-3 py-2.5 text-xs"><span>{actionLabels[item.action] ?? item.action}{item.entityId ? ` · ${item.entityId}` : ""}</span><span className="text-[#958a7b]">{item.adminName ?? "مدیر حذف‌شده"} · {new Date(item.createdAt).toLocaleString("fa-IR")}</span></div>)}</div></div>
  </section>;
}
