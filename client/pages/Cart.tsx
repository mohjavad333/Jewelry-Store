import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { CartItem, cartEventName, getCart, saveCart } from "@/lib/cart";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { calculateCustomizationCost, calculateGoldPricing } from "@shared/gold";

const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export default function Cart() {
  const [items, setItems] = useState<CartItem[]>(getCart);
  const [now, setNow] = useState(Date.now());
  const snapshot = useGoldPrice();

  useEffect(() => {
    const sync = () => setItems(getCart());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener(cartEventName(), sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(cartEventName(), sync);
    };
  }, []);

  const updateQuantity = (
    itemId: number,
    customization: string | undefined,
    quantity: number,
  ) => {
    const next = items.map((item) =>
      item.id === itemId && item.customization === customization
        ? { ...item, quantity: Math.max(1, quantity) }
        : item,
    );
    setItems(next);
    saveCart(next);
  };

  const removeItem = (itemId: number, customization: string | undefined) => {
    const next = items.filter(
      (item) => !(item.id === itemId && item.customization === customization),
    );
    setItems(next);
    saveCart(next);
  };

  const summary = useMemo(() => {
    const base = items.reduce((total, item) => {
      const pricing = calculateGoldPricing(snapshot, {
        weight: item.weight,
        karat: item.karat ?? 18,
      });
      return total + pricing.rawGold * item.quantity;
    }, 0);
    const making = Math.round(base * 0.12);
    const profit = Math.round((base + making) * 0.07);
    const tax = Math.round((making + profit) * 0.1);
    const customization = items.reduce(
      (total, item) =>
        total + calculateCustomizationCost(item.customization) * item.quantity,
      0,
    );
    const shipping = base >= 5_000_000 || base === 0 ? 0 : 180_000;
    return {
      base,
      making,
      profit,
      tax,
      customization,
      shipping,
      total: base + making + profit + tax + customization + shipping,
    };
  }, [items, snapshot]);

  const lineTotal = (item: CartItem) => {
    const pricing = calculateGoldPricing(snapshot, {
      weight: item.weight,
      karat: item.karat ?? 18,
    });
    return (pricing.total + calculateCustomizationCost(item.customization)) * item.quantity;
  };

  const remaining = (until: number) =>
    Math.max(0, Math.ceil((until - now) / 1000));
  const formatTimer = (seconds: number) =>
    `${number(Math.floor(seconds / 60))}:${String(seconds % 60)
      .padStart(2, "0")
      .replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])}`;

  return (
    <main dir="rtl" className="min-h-screen bg-[#fcfaf7] text-[#29251f]">
      <div className="bg-[#25231f] px-4 py-2 text-center text-xs text-[#e9c982]">
        سبد خرید شما تا ۱۵ دقیقه رزرو می‌شود · پرداخت امن زرین‌سا
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
            to="/"
            className="flex items-center gap-2 text-sm text-[#756b5e]"
          >
            <ArrowRight size={17} /> ادامه خرید
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="mb-8">
          <p className="mb-2 text-sm text-[#a47b32]">خرید شما</p>
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">
            سبد خرید{" "}
            <span className="text-base font-sans font-normal text-[#9b9184]">
              ({number(items.reduce((sum, item) => sum + item.quantity, 0))}{" "}
              محصول)
            </span>
          </h1>
        </div>
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d8cbb8] bg-white px-5 py-20 text-center">
            <ShoppingBag className="mx-auto mb-5 text-[#b89145]" size={42} />
            <h2 className="font-serif text-2xl font-bold">
              سبد خرید شما خالی است
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#8b8174]">
              قطعه‌ای که دوست دارید را به سبد اضافه کنید تا خریدتان را با
              اطمینان ادامه دهید.
            </p>
            <Link
              to="/#collection"
              className="mt-7 inline-flex rounded-full bg-[#b89145] px-6 py-3 text-sm font-medium text-white"
            >
              مشاهده محصولات
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
            <section className="space-y-4">
              {items.map((item) => (
                <article
                  key={`${item.id}-${item.customization ?? "default"}`}
                  className="flex gap-4 rounded-2xl border border-[#e9e0d4] bg-white p-4 sm:gap-5"
                >
                  <Link to={`/product/${item.id}`} className="shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-28 w-24 rounded-xl object-cover sm:h-32 sm:w-28"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/product/${item.id}`}
                          className="font-medium hover:text-[#a47b32]"
                        >
                          {item.name}
                        </Link>
                        <p className="mt-1 text-xs text-[#9b9184]">
                          {number(item.weight)} گرم · طلای {number(item.karat ?? 18)} عیار
                        </p>
                        {item.customization && (
                          <p className="mt-2 text-xs leading-6 text-[#8b682e]">
                            سفارشی‌سازی: {item.customization}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id, item.customization)}
                        className="rounded-lg p-2 text-[#b7aa9c] hover:bg-[#f7efea] hover:text-[#a55b4b]"
                        aria-label="حذف محصول"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
                      <div className="flex items-center rounded-lg border border-[#e2d9cb]">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              item.customization,
                              item.quantity - 1,
                            )
                          }
                          className="p-2 text-[#7b6b56]"
                          aria-label={`کاهش تعداد ${item.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-7 text-center text-xs">
                          {number(item.quantity)}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              item.customization,
                              item.quantity + 1,
                            )
                          }
                          className="p-2 text-[#7b6b56]"
                          aria-label={`افزایش تعداد ${item.name}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="text-left font-semibold text-[#80602b]">
                        {number(lineTotal(item))}{" "}
                        <span className="text-[10px] font-normal text-[#9b9184]">
                          تومان
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-[10px] text-[#b07e36]">
                      <Clock3 size={12} /> رزرو موجودی تا{" "}
                      {formatTimer(remaining(item.reservedUntil))}
                    </div>
                  </div>
                </article>
              ))}
            </section>
            <aside className="rounded-3xl border border-[#e9e0d4] bg-white p-5 sm:p-6">
              <h2 className="mb-5 font-serif text-xl font-bold">خلاصه سفارش</h2>
              <div className="space-y-3 text-sm text-[#817769]">
                <div className="flex justify-between">
                  <span>قیمت طلا</span>
                  <span>{number(summary.base)} تومان</span>
                </div>
                <div className="flex justify-between">
                  <span>اجرت ساخت</span>
                  <span>{number(summary.making)} تومان</span>
                </div>
                <div className="flex justify-between">
                  <span>سود فروشنده</span>
                  <span>{number(summary.profit)} تومان</span>
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
                  <span>ارسال بیمه‌شده</span>
                  <span>
                    {summary.shipping === 0 ? (
                      <span className="text-[#4eaa76]">رایگان</span>
                    ) : (
                      `${number(summary.shipping)} تومان`
                    )}
                  </span>
                </div>
              </div>
              <div className="my-5 border-t border-[#eee7de] pt-5">
                <div className="flex items-end justify-between">
                  <span className="font-medium">مبلغ قابل پرداخت</span>
                  <span className="text-left text-xl font-bold text-[#8b682e]">
                    {number(summary.total)}
                    <small className="mr-1 text-[10px] font-normal text-[#9b9184]">
                      تومان
                    </small>
                  </span>
                </div>
              </div>
              <Link
                to="/checkout"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b89145] py-3.5 font-medium text-white transition hover:bg-[#9f7936]"
              >
                ادامه و پرداخت امن
              </Link>
              <div className="mt-5 space-y-3 border-t border-[#eee7de] pt-5 text-xs text-[#8b8174]">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#b89145]" /> پرداخت
                  امن و رمزنگاری‌شده
                </div>
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-[#b89145]" /> ارسال با بیمه
                  کامل
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
      <footer className="border-t border-[#e9e0d4] px-5 py-8 text-center text-xs text-[#948a7d]">
        © ۱۴۰۴ زرین‌سا · خانه‌ای برای درخشش ماندگار
      </footer>
    </main>
  );
}
