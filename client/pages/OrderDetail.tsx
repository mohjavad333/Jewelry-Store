import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronLeft, Clock3, FileText, MapPin, PackageCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";

type TimelineItem = { title: string; text: string; completed: boolean; date: string };
type OrderItem = { id: number; name: string; quantity: number; weight: number; price: number; image: string; customization?: string };
type Order = { id: string; date: string; status: string; tracking: string; note?: string; expiresAt: string | null; items: OrderItem[]; address: { title: string; receiver: string; phone: string; details: string; postalCode: string }; totals: { base: number; making: number; profit: number; tax: number; shipping: number; insurance: number; customization: number; total: number } };
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const formatDate = (value: string) => new Date(value).toLocaleDateString("fa-IR");

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(id ?? "")}`, { credentials: "include" });
      const data = await response.json() as { order?: Order; timeline?: TimelineItem[]; message?: string };
      if (!response.ok || !data.order) {
        setNotice(data.message ?? "سفارش پیدا نشد یا دسترسی شما به آن معتبر نیست.");
        return;
      }
      setOrder(data.order);
      setTimeline(data.timeline ?? []);
    } catch {
      setNotice("ارتباط با سرویس سفارش برقرار نشد.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOrder(); }, [id]);

  const cancelOrder = async () => {
    if (!order || !window.confirm("آیا از لغو این سفارش مطمئن هستید؟")) return;
    setCancelling(true);
    setNotice("");
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(order.id)}/cancel`, { method: "POST", credentials: "include" });
      const data = await response.json() as { message?: string };
      if (!response.ok) {
        setNotice(data.message ?? "لغو سفارش انجام نشد.");
        return;
      }
      await loadOrder();
      toast.success("سفارش لغو شد و موجودی آزاد شد.");
      setNotice("سفارش لغو شد و موجودی آزاد شد.");
    } catch {
      setNotice("ارتباط با سرویس سفارش برقرار نشد.");
    } finally {
      setCancelling(false);
    }
  };

  return <main dir="rtl" className="min-h-screen bg-[#f7f4ef] text-[#29251f]">
    <header className="border-b border-[#e6dfd4] bg-[#302b24] text-white"><div className="mx-auto flex h-[76px] max-w-5xl items-center justify-between px-5"><Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b89145]"><Sparkles size={19} /></span><span><span className="block font-serif text-xl font-bold">زرین‌سا</span><span className="block text-[10px] tracking-[0.18em] text-[#d5b879]">JEWELRY HOUSE</span></span></Link><Link to="/auth" className="flex items-center gap-2 text-sm text-[#d5c8b8]"><ArrowRight size={17} /> حساب کاربری</Link></div></header>
    <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-14">{loading ? <div className="rounded-3xl bg-white p-16 text-center text-sm text-[#817769]">در حال دریافت جزئیات سفارش...</div> : notice && !order ? <div className="rounded-3xl bg-white p-16 text-center text-sm text-[#a55b4b]">{notice}</div> : order && <><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><Link to="/auth" className="mb-4 flex items-center gap-1 text-sm text-[#8b682e]"><ChevronLeft size={16} /> بازگشت به سفارش‌ها</Link><p className="mb-2 text-sm text-[#a47b32]">پیگیری خرید</p><h1 className="font-serif text-3xl font-bold">جزئیات سفارش</h1><p className="mt-2 text-sm text-[#817769]">{order.id} · ثبت‌شده در {formatDate(order.date)}</p></div><span className={`rounded-full px-4 py-2 text-sm ${order.status === "لغو شده" ? "bg-[#fff0ed] text-[#a55b4b]" : order.status === "تحویل شده" ? "bg-[#eaf6ee] text-[#4c9062]" : "bg-[#f8f0df] text-[#956f2d]"}`}>{order.status}</span></div>{notice && <div className="mb-6 rounded-xl bg-[#f0f7f1] p-3 text-sm text-[#4d8c63]">{notice}</div>}<div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><div className="space-y-6"><section className="rounded-3xl border border-[#e9e0d4] bg-white p-6 sm:p-8"><div className="mb-6 flex items-center justify-between"><div><p className="mb-1 text-sm text-[#a47b32]">وضعیت سفارش</p><h2 className="font-serif text-2xl font-bold">مراحل آماده‌سازی</h2></div><PackageCheck className="text-[#b89145]" /></div><div className="space-y-5">{timeline.map((item, index) => <div key={`${item.title}-${index}`} className="flex gap-4"><div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.completed ? "bg-[#b89145] text-white" : "bg-[#f0ece5] text-[#b9ad9d]"}`}>{item.completed ? <Check size={17} /> : <Clock3 size={16} />}{index < timeline.length - 1 && <span className="absolute right-1/2 top-9 h-8 w-px translate-x-1/2 bg-[#e6dfd4]" />}</div><div><h3 className={`text-sm font-medium ${item.completed ? "text-[#493d2f]" : "text-[#958a7b]"}`}>{item.title}</h3><p className="mt-1 text-xs leading-6 text-[#8b8174]">{item.text}</p>{item.date && <p className="mt-1 text-[10px] text-[#b08a4a]">{formatDate(item.date)}</p>}</div></div>)}</div>{order.expiresAt && order.status === "در انتظار پرداخت" && <div className="mt-6 flex items-center gap-2 rounded-xl bg-[#fff8e9] p-3 text-xs text-[#987333]"><Clock3 size={16} /> رزرو این سفارش تا {new Date(order.expiresAt).toLocaleTimeString("fa-IR")} معتبر است.</div>}</section><section className="rounded-3xl border border-[#e9e0d4] bg-white p-6 sm:p-8"><div className="mb-5 flex items-center gap-2"><MapPin className="text-[#b89145]" size={19} /><h2 className="font-medium">آدرس تحویل</h2></div><div className="rounded-2xl bg-[#fcfaf7] p-4 text-sm"><p className="font-medium">{order.address.title} · {order.address.receiver}</p><p className="mt-2 leading-7 text-[#756b5e]">{order.address.details}</p><p className="mt-1 text-xs text-[#8b8174]">{order.address.phone} · کد پستی: {order.address.postalCode}</p></div></section></div><div className="space-y-6"><section className="rounded-3xl border border-[#e9e0d4] bg-white p-6 sm:p-8"><div className="mb-5 flex items-center justify-between"><h2 className="font-medium">اقلام سفارش</h2><span className="text-xs text-[#958a7b]">{number(order.items.reduce((sum, item) => sum + item.quantity, 0))} عدد</span></div><div className="space-y-4">{order.items.map((item) => <div key={`${item.id}-${item.name}`} className="flex gap-3 border-b border-[#eee7de] pb-4 last:border-0 last:pb-0"><img src={item.image} alt={item.name} className="h-16 w-16 rounded-xl object-cover" /><div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{item.name}</h3><p className="mt-1 text-xs text-[#8b8174]">تعداد: {number(item.quantity)} · وزن: {item.weight} گرم</p>{item.customization && <p className="mt-1 text-[10px] text-[#a47b32]">{item.customization}</p>}</div><strong className="whitespace-nowrap text-xs text-[#8b682e]">{number(item.price * item.quantity)} تومان</strong></div>)}</div></section><section className="rounded-3xl border border-[#e9e0d4] bg-white p-6 sm:p-8"><h2 className="mb-5 font-medium">خلاصه مبلغ</h2><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-[#817769]">ارزش طلا</span><span>{number(order.totals.base)} تومان</span></div><div className="flex justify-between"><span className="text-[#817769]">اجرت و سود</span><span>{number(order.totals.making + order.totals.profit)} تومان</span></div><div className="flex justify-between"><span className="text-[#817769]">مالیات</span><span>{number(order.totals.tax)} تومان</span></div><div className="flex justify-between"><span className="text-[#817769]">ارسال و بیمه</span><span>{number(order.totals.shipping + order.totals.insurance)} تومان</span></div>{order.totals.customization > 0 && <div className="flex justify-between"><span className="text-[#817769]">سفارشی‌سازی</span><span>{number(order.totals.customization)} تومان</span></div>}<div className="mt-4 flex justify-between border-t border-[#eee7de] pt-4 text-base font-bold"><span>مبلغ نهایی</span><span className="text-[#8b682e]">{number(order.totals.total)} تومان</span></div></div></section><div className="flex flex-wrap gap-2"><Link to={`/invoice/${encodeURIComponent(order.id)}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#302b24] px-4 py-3 text-xs text-white"><FileText size={15} /> مشاهده فاکتور</Link>{order.tracking && <Link to={`/track/${encodeURIComponent(order.tracking)}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#dfd5c7] px-4 py-3 text-xs text-[#756b5e]"><Truck size={15} /> رهگیری ارسال</Link>}{order.status === "در انتظار پرداخت" && <button disabled={cancelling} onClick={() => void cancelOrder()} className="w-full rounded-xl border border-[#edcfc8] px-4 py-3 text-xs text-[#a55b4b] disabled:opacity-50">{cancelling ? "در حال لغو..." : "لغو سفارش"}</button>}</div><div className="flex gap-3 rounded-2xl bg-[#f3eadc] p-4 text-xs leading-6 text-[#80663b]"><ShieldCheck className="mt-1 shrink-0" size={17} /> اطلاعات این سفارش فقط برای حساب صاحب آن نمایش داده می‌شود.</div></div></div></>}
    </div>
  </main>;
}
