import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Bell, Check, CheckCircle2, FileText, PackageCheck, Sparkles } from "lucide-react";

type Notification = { id: string; title: string; text: string; date: string; read: boolean };
const formatDate = (value: string) => new Date(value).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/account/notifications", { credentials: "include" });
      const data = await response.json() as { notifications?: Notification[]; message?: string };
      if (!response.ok) {
        setNotice(data.message ?? "برای مشاهده اعلان‌ها ابتدا وارد حساب شوید.");
        return;
      }
      setItems(data.notifications ?? []);
    } catch {
      setNotice("ارتباط با مرکز اعلان‌ها برقرار نشد.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadNotifications(); }, []);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const markAsRead = async (id: string) => {
    setMarking(id);
    try {
      const response = await fetch(`/api/account/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", credentials: "include" });
      if (!response.ok) {
        setNotice("به‌روزرسانی وضعیت اعلان انجام نشد.");
        return;
      }
      setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
      toast.success("اعلان خوانده شد.");
    } catch {
      setNotice("ارتباط با مرکز اعلان‌ها برقرار نشد.");
    } finally {
      setMarking(null);
    }
  };

  const markAllAsRead = async () => {
    const unread = items.filter((item) => !item.read);
    await Promise.all(unread.map((item) => markAsRead(item.id)));
    if (unread.length > 0) toast.success("همه اعلان‌ها خوانده شدند.");
  };

  return <main dir="rtl" className="min-h-screen bg-[#fcfaf7] text-[#29251f]">
    <header className="border-b border-[#e6dfd4] bg-[#fcfaf7]"><div className="mx-auto flex h-[76px] max-w-4xl items-center justify-between px-5"><Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b89145] text-white"><Sparkles size={19} /></span><span><span className="block font-serif text-xl font-bold">زرین‌سا</span><span className="block text-[10px] tracking-[0.18em] text-[#9c7a3c]">JEWELRY HOUSE</span></span></Link><Link to="/auth" className="flex items-center gap-2 text-sm text-[#756b5e]"><ArrowRight size={17} /> حساب کاربری</Link></div></header>
    <div className="mx-auto max-w-3xl px-5 py-12 lg:px-8"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-sm text-[#a47b32]">مرکز پیام‌ها</p><h1 className="font-serif text-3xl font-bold">اعلان‌های من</h1><p className="mt-2 text-sm text-[#817769]">{unreadCount ? `${unreadCount} اعلان خوانده‌نشده دارید.` : "همه اعلان‌ها خوانده شده‌اند."}</p></div><div className="flex items-center gap-2"><Bell className="text-[#b89145]" size={27} />{unreadCount > 0 && <button onClick={() => void markAllAsRead()} className="rounded-xl border border-[#dfd5c7] px-3 py-2 text-xs text-[#756b5e]">خواندن همه</button>}</div></div>{loading ? <div className="rounded-2xl bg-white p-14 text-center text-sm text-[#958a7b]">در حال دریافت اعلان‌ها...</div> : notice && items.length === 0 ? <div className="rounded-2xl bg-[#fff3ed] p-5 text-center text-sm text-[#a55b4b]">{notice}</div> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d8cbb8] bg-white p-14 text-center text-sm text-[#958a7b]">اعلان جدیدی ندارید.</div> : <div className="space-y-3">{items.map((item) => <article key={item.id} className={`rounded-2xl border bg-white p-5 ${item.read ? "border-[#e9e0d4]" : "border-[#d8bd85] shadow-sm"}`}><div className="flex gap-4"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.read ? "bg-[#f4f0e9] text-[#9b8d7a]" : "bg-[#f5ead6] text-[#a47b32]"}`}>{item.title.includes("فاکتور") ? <FileText size={18} /> : item.title.includes("سفارش") ? <PackageCheck size={18} /> : <Bell size={18} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-medium">{item.title}</h2>{!item.read && <span className="rounded-full bg-[#f5ead6] px-2 py-1 text-[10px] text-[#956f2d]">جدید</span>}</div><p className="mt-2 text-sm leading-7 text-[#756b5e]">{item.text}</p><p className="mt-2 text-[10px] text-[#a59a8c]">{formatDate(item.date)}</p>{!item.read && <button disabled={marking === item.id} onClick={() => void markAsRead(item.id)} className="mt-3 flex items-center gap-1 text-xs text-[#8b682e] disabled:opacity-50"><Check size={14} /> {marking === item.id ? "در حال ثبت..." : "علامت‌گذاری به‌عنوان خوانده‌شده"}</button>}{item.read && <span className="mt-3 flex items-center gap-1 text-[10px] text-[#6f9d79]"><CheckCircle2 size={13} /> خوانده شده</span>}</div></div></article>)}</div>}</div>
  </main>;
}
