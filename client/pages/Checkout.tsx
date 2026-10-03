import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  CreditCard,
  LockKeyhole,
  MapPin,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { CartItem, getCart, saveCart } from "@/lib/cart";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { calculateCustomizationCost, calculateGoldPricing } from "@shared/gold";

type Address = {
  id: string;
  title: string;
  receiver: string;
  phone: string;
  details: string;
  postalCode: string;
};
type CreatedOrder = {
  id: string;
  tracking: string;
  status: string;
  expiresAt?: string | null;
  totals: { total: number };
};
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const getAddresses = (): Address[] => {
  try {
    const value = window.localStorage.getItem("zarinsa-addresses");
    return value ? (JSON.parse(value) as Address[]) : [];
  } catch {
    return [];
  }
};

export default function Checkout() {
  const [items] = useState<CartItem[]>(getCart);
  const snapshot = useGoldPrice();
  const [addresses, setAddresses] = useState<Address[]>(getAddresses);
  const [selectedAddress, setSelectedAddress] = useState(
    addresses[0]?.id ?? "",
  );
  const [showAddressForm, setShowAddressForm] = useState(
    addresses.length === 0,
  );
  const [newAddress, setNewAddress] = useState({
    title: "خانه",
    receiver: "",
    phone: "",
    details: "",
    postalCode: "",
  });
  const [insurance, setInsurance] = useState(true);
  const [payment, setPayment] = useState("gateway");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [idempotencyKey] = useState(
    () => `ZS-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
  );
  const summary = useMemo(() => {
    const base = items.reduce(
      (total, item) =>
        total +
        calculateGoldPricing(snapshot, { weight: item.weight, karat: item.karat ?? 18 }).rawGold * item.quantity,
      0,
    );
    const making = Math.round(base * 0.12);
    const profit = Math.round((base + making) * 0.07);
    const tax = Math.round((making + profit) * 0.1);
    const shipping = base >= 5_000_000 || base === 0 ? 0 : 180_000;
    const insuranceCost = insurance ? Math.round(base * 0.003) : 0;
    const customization = items.reduce(
      (total, item) => total + calculateCustomizationCost(item.customization) * item.quantity,
      0,
    );
    return {
      base,
      making,
      profit,
      tax,
      shipping,
      insuranceCost,
      customization,
      total:
        base + making + profit + tax + shipping + insuranceCost + customization,
    };
  }, [items, insurance, snapshot]);
  const address = addresses.find((item) => item.id === selectedAddress);
  const updateAddress = (field: keyof typeof newAddress, value: string) =>
    setNewAddress((current) => ({ ...current, [field]: value }));
  const createAddress = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !newAddress.receiver ||
      !newAddress.phone ||
      !newAddress.details ||
      !newAddress.postalCode
    ) {
      setNotice("همه اطلاعات آدرس را کامل کنید.");
      return;
    }
    setSavingAddress(true);
    setNotice("");
    try {
      const response = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newAddress),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(
          response.status === 401
            ? "برای ثبت آدرس ابتدا وارد حساب کاربری شوید."
            : data.message ?? "ذخیره آدرس انجام نشد.",
        );
        return;
      }
      const next = [...addresses, data.address];
      setAddresses(next);
      setSelectedAddress(data.address.id);
      window.localStorage.setItem("zarinsa-addresses", JSON.stringify(next));
      setNewAddress({
        title: "خانه",
        receiver: "",
        phone: "",
        details: "",
        postalCode: "",
      });
      setShowAddressForm(false);
    } catch {
      setNotice("ارتباط با سرویس آدرس برقرار نشد.");
    } finally {
      setSavingAddress(false);
    }
  };
  const submitOrder = async () => {
    if (!address) {
      setNotice("لطفاً یک آدرس تحویل انتخاب یا ثبت کنید.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          idempotencyKey,
          address,
          insurance,
          paymentMethod: payment,
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            weight: item.weight,
            karat: item.karat ?? 18,
            quantity: item.quantity,
            image: item.image,
            customization: item.customization,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(
          response.status === 401
            ? "برای ثبت سفارش ابتدا وارد حساب کاربری شوید."
            : (data.message ?? "ثبت سفارش انجام نشد."),
        );
        return;
      }
      setOrder(data.order);
      saveCart([]);
      toast.success("سفارش با موفقیت ثبت شد.");
    } catch {
      setNotice("ارتباط با سرویس ثبت سفارش برقرار نشد.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#fcfaf7] text-[#29251f]">
      <div className="bg-[#25231f] px-4 py-2 text-center text-xs text-[#e9c982]">
        ثبت سفارش امن زرین‌سا · قیمت نهایی در سرور محاسبه می‌شود
      </div>
      <header className="border-b border-[#e6dfd4] bg-[#fcfaf7]">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b89145] text-white">
              <ShoppingBag size={19} />
            </span>
            <span>
              <span className="block font-serif text-xl font-bold">
                زرین‌سا
              </span>
              <span className="block text-[10px] tracking-[0.18em] text-[#9c7a3c]">
                JEWELRY HOUSE
              </span>
            </span>
          </Link>
          <Link
            to="/cart"
            className="flex items-center gap-2 text-sm text-[#756b5e]"
          >
            <ArrowRight size={17} /> بازگشت به سبد
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
        {order ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-[#dcebdd] bg-white p-8 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e9f5ed] text-[#4e9b6b]">
              <Check size={32} />
            </div>
            <p className="mt-6 text-sm text-[#4e9b6b]">سفارش در سرور ثبت شد</p>
            <h1 className="mt-2 font-serif text-3xl font-bold">
              سفارش شما آماده پرداخت است
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#817769]">
              پس از اتصال درگاه، وضعیت سفارش به‌صورت خودکار به «پرداخت شده»
              تغییر خواهد کرد.
            </p>
            {order.expiresAt && (
              <p className="mt-3 rounded-xl bg-[#fff8e8] px-4 py-3 text-xs leading-6 text-[#8b682e]">
                این سفارش تا{" "}
                {new Date(order.expiresAt).toLocaleTimeString("fa-IR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                برای شما رزرو است.
              </p>
            )}
            <div className="mt-7 space-y-3 rounded-2xl bg-[#fcfaf7] p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#8b8174]">شماره سفارش</span>
                <strong>{order.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b8174]">کد رهگیری</span>
                <strong>{order.tracking}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b8174]">مبلغ سفارش</span>
                <strong className="text-[#8b682e]">
                  {number(order.totals.total)} تومان
                </strong>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                to="/auth"
                className="rounded-full bg-[#b89145] px-5 py-3 text-sm font-medium text-white"
              >
                مشاهده تاریخچه سفارش‌ها
              </Link>
              <Link
                to="/"
                className="rounded-full border border-[#dfd5c7] px-5 py-3 text-sm"
              >
                بازگشت به فروشگاه
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="mb-2 text-sm text-[#a47b32]">مرحله نهایی خرید</p>
              <h1 className="font-serif text-3xl font-bold sm:text-4xl">
                تکمیل سفارش
              </h1>
            </div>
            {items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#d8cbb8] bg-white p-16 text-center">
                <ShoppingBag
                  className="mx-auto mb-4 text-[#b89145]"
                  size={40}
                />
                <p>سبد خرید شما خالی است.</p>
                <Link
                  to="/"
                  className="mt-6 inline-flex rounded-full bg-[#b89145] px-5 py-3 text-sm text-white"
                >
                  بازگشت به فروشگاه
                </Link>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
                <section className="space-y-5">
                  <div className="rounded-2xl border border-[#e9e0d4] bg-white p-5 sm:p-7">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h2 className="font-medium">آدرس تحویل</h2>
                        <p className="mt-1 text-xs text-[#958a7b]">
                          آدرس را انتخاب یا مستقیماً در همین صفحه ثبت کنید.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAddressForm(!showAddressForm)}
                        aria-expanded={showAddressForm}
                        className="flex items-center gap-1 text-xs text-[#a47b32]"
                      >
                        <Plus size={15} />{" "}
                        {showAddressForm ? "بستن فرم" : "آدرس جدید"}
                      </button>
                    </div>
                    {showAddressForm && (
                      <form
                        id="new-address-form"
                        onSubmit={createAddress}
                        className="mb-5 rounded-2xl bg-[#fcfaf7] p-4"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs text-[#70675b]">
                            عنوان آدرس
                            <select
                              value={newAddress.title}
                              onChange={(event) =>
                                updateAddress("title", event.target.value)
                              }
                              className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-3 text-sm outline-none"
                            >
                              <option>خانه</option>
                              <option>محل کار</option>
                              <option>سایر</option>
                            </select>
                          </label>
                          <label className="text-xs text-[#70675b]">
                            نام تحویل‌گیرنده
                            <input
                              value={newAddress.receiver}
                              onChange={(event) =>
                                updateAddress("receiver", event.target.value)
                              }
                              autoComplete="name"
                              className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-3 text-sm outline-none"
                            />
                          </label>
                          <label className="text-xs text-[#70675b]">
                            شماره موبایل
                            <input
                              value={newAddress.phone}
                              onChange={(event) =>
                                updateAddress("phone", event.target.value)
                              }
                              autoComplete="tel"
                              dir="ltr"
                              className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-3 text-left text-sm outline-none"
                            />
                          </label>
                          <label className="text-xs text-[#70675b]">
                            کد پستی ۱۰ رقمی
                            <input
                              value={newAddress.postalCode}
                              onChange={(event) =>
                                updateAddress("postalCode", event.target.value)
                              }
                              autoComplete="postal-code"
                              dir="ltr"
                              className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-3 text-left text-sm outline-none"
                            />
                          </label>
                          <label className="text-xs text-[#70675b] sm:col-span-2">
                            نشانی کامل
                            <textarea
                              value={newAddress.details}
                              onChange={(event) =>
                                updateAddress("details", event.target.value)
                              }
                              autoComplete="street-address"
                              className="mt-2 min-h-24 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-3 text-sm outline-none"
                            />
                          </label>
                        </div>
                        <button
                          disabled={savingAddress}
                          className="mt-4 rounded-xl bg-[#302b24] px-5 py-3 text-sm text-white disabled:opacity-50"
                        >
                          {savingAddress
                            ? "در حال ذخیره..."
                            : "ذخیره و انتخاب آدرس"}
                        </button>
                        <p className="mt-3 text-xs text-[#958a7b]">
                          برای ذخیره آدرس باید وارد حساب کاربری باشید.{" "}
                          <Link to="/auth" className="text-[#a47b32]">
                            ورود یا ثبت‌نام
                          </Link>
                        </p>
                      </form>
                    )}
                    {addresses.length === 0 && !showAddressForm ? (
                      <div className="rounded-xl bg-[#f8f3eb] p-4 text-sm text-[#817769]">
                        هنوز آدرسی ثبت نشده است. از گزینه «آدرس جدید» استفاده
                        کنید.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {addresses.map((item) => (
                          <label
                            key={item.id}
                            className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${selectedAddress === item.id ? "border-[#b89145] bg-[#fffaf0]" : "border-[#e9e0d4]"}`}
                          >
                            <input
                              type="radio"
                              checked={selectedAddress === item.id}
                              onChange={() => setSelectedAddress(item.id)}
                              className="mt-1 accent-[#b89145]"
                            />
                            <span>
                              <span className="flex items-center gap-2 text-sm font-medium">
                                <MapPin size={16} className="text-[#b89145]" />{" "}
                                {item.title}
                              </span>
                              <span className="mt-1 block text-xs leading-6 text-[#817769]">
                                {item.receiver} · {item.phone}
                                <br />
                                {item.details} · کد پستی {item.postalCode}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-[#e9e0d4] bg-white p-5 sm:p-7">
                    <h2 className="mb-5 font-medium">روش پرداخت</h2>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${payment === "gateway" ? "border-[#b89145] bg-[#fffaf0]" : "border-[#e9e0d4]"}`}
                    >
                      <input
                        type="radio"
                        checked={payment === "gateway"}
                        onChange={() => setPayment("gateway")}
                        className="accent-[#b89145]"
                      />
                      <CreditCard size={19} className="text-[#b89145]" />
                      <span>
                        <span className="block text-sm font-medium">
                          درگاه پرداخت آنلاین
                        </span>
                        <span className="mt-1 block text-xs text-[#958a7b]">
                          سفارش ثبت می‌شود و آماده اتصال به درگاه است.
                        </span>
                      </span>
                    </label>
                    <label
                      className={`mt-3 flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${payment === "manual" ? "border-[#b89145] bg-[#fffaf0]" : "border-[#e9e0d4]"}`}
                    >
                      <input
                        type="radio"
                        checked={payment === "manual"}
                        onChange={() => setPayment("manual")}
                        className="accent-[#b89145]"
                      />
                      <Truck size={19} className="text-[#b89145]" />
                      <span>
                        <span className="block text-sm font-medium">
                          پرداخت کارت‌به‌کارت
                        </span>
                        <span className="mt-1 block text-xs text-[#958a7b]">
                          ثبت سفارش و بررسی دستی پرداخت.
                        </span>
                      </span>
                    </label>
                  </div>
                </section>
                <aside className="rounded-2xl border border-[#e9e0d4] bg-white p-5 sm:p-7">
                  <h2 className="mb-5 font-medium">خلاصه سفارش</h2>
                  <div className="space-y-3 text-sm text-[#817769]">
                    <div className="flex justify-between">
                      <span>ارزش طلای خام</span>
                      <span>{number(summary.base)} تومان</span>
                    </div>
                    <div className="flex justify-between">
                      <span>اجرت و سود</span>
                      <span>
                        {number(summary.making + summary.profit)} تومان
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>مالیات</span>
                      <span>{number(summary.tax)} تومان</span>
                    </div>
                    {summary.customization > 0 && (
                      <div className="flex justify-between">
                        <span>سفارشی‌سازی</span>
                        <span>{number(summary.customization)} تومان</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>ارسال</span>
                      <span>
                        {summary.shipping
                          ? `${number(summary.shipping)} تومان`
                          : "رایگان"}
                      </span>
                    </div>
                    <label className="flex items-center justify-between border-t border-[#eee7de] pt-3">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-[#b89145]" />{" "}
                        بیمه سفارش
                      </span>
                      <input
                        type="checkbox"
                        checked={insurance}
                        onChange={(event) => setInsurance(event.target.checked)}
                        className="h-4 w-4 accent-[#b89145]"
                      />
                    </label>
                    {insurance && (
                      <div className="flex justify-between text-xs">
                        <span>هزینه بیمه</span>
                        <span>{number(summary.insuranceCost)} تومان</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-5 flex justify-between border-t border-[#eee7de] pt-5 text-lg font-bold">
                    <span>مبلغ نهایی</span>
                    <span className="text-[#8b682e]">
                      {number(summary.total)} تومان
                    </span>
                  </div>
                  {notice && (
                    <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-[#fff3ed] p-3 text-xs leading-6 text-[#a55b4b]">
                      {notice}
                    </p>
                  )}
                  <button
                    onClick={submitOrder}
                    disabled={submitting || !address}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b89145] px-5 py-3.5 font-medium text-white transition hover:bg-[#9f7936] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LockKeyhole size={17} />
                    {submitting
                      ? "در حال ثبت سفارش..."
                      : "ثبت سفارش و ادامه پرداخت"}
                  </button>
                  <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-[#958a7b]">
                    <ShieldCheck size={15} className="text-[#4eaa76]" /> قیمت
                    نهایی در Backend دوباره محاسبه و اعتبارسنجی می‌شود.
                  </p>
                </aside>
              </div>
            )}
          </>
        )}
      </div>
      <footer className="border-t border-[#e9e0d4] px-5 py-8 text-center text-xs text-[#948a7d]">
        © ۱۴۰۴ زرین‌سا · دسترسی امن به Checkout
      </footer>
    </main>
  );
}
