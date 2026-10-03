import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addToCart } from "@/lib/cart";
import { getWishlist, toggleWishlist, wishlistEventName } from "@/lib/wishlist";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { calculateCustomizationCost, calculateGoldPricing } from "@shared/gold";
import { products as catalog, type Product } from "@shared/products";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  Gift,
  Gem,
  Heart,
  Info,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";

const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export default function ProductDetail() {
  const { id } = useParams();
  const productId = Number(id);
  const [product, setProduct] = useState<Product | undefined>(() => catalog.find((item) => item.id === productId));
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(() => getWishlist().includes(productId));
  const [customization, setCustomization] = useState("بدون سفارشی‌سازی");
  const [engraving, setEngraving] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [stone, setStone] = useState("بدون سنگ");
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(product?.image ?? "");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setRequestError(false);
    setQuantity(1);
    fetch(`/api/products/${id}`)
      .then(async (response) => {
        if (response.status === 404) throw new Error("product-not-found");
        if (!response.ok) throw new Error("product-request-failed");
        return response.json() as Promise<{ product?: Product }>;
      })
      .then((data) => {
        if (!active) return;
        if (!data.product) throw new Error("product-not-found");
        setProduct(data.product);
        setLiked(getWishlist().includes(data.product.id));
      })
      .catch((error: unknown) => {
        if (!active) return;
        const fallback = catalog.find((item) => item.id === productId);
        const productNotFound = error instanceof Error && error.message === "product-not-found";
        setProduct(fallback);
        setNotFound(productNotFound && !fallback);
        setRequestError(!productNotFound && !fallback);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, productId, retryToken]);

  useEffect(() => {
    const syncWishlist = () => setLiked(getWishlist().includes(productId));
    window.addEventListener(wishlistEventName(), syncWishlist);
    return () => window.removeEventListener(wishlistEventName(), syncWishlist);
  }, [productId]);

  useEffect(() => {
    if (product) setSelectedImage(product.image);
  }, [product?.id, product?.image]);

  const snapshot = useGoldPrice();
  const pricing = useMemo(() => {
    const currentProduct = product ?? catalog[0];
    const result = calculateGoldPricing(snapshot, { weight: currentProduct.weight, karat: currentProduct.karat });
    return { gold: result.rawGold, making: result.making, sellerProfit: result.profit, tax: result.tax, total: result.total };
  }, [product, snapshot]);

  if (loading) return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fcfaf7] text-sm text-[#817769]">در حال دریافت اطلاعات محصول...</main>;
  if (requestError) return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fcfaf7] px-5 text-center text-[#29251f]">
      <div className="flex max-w-md flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4ead8] text-[#a47b32]"><Info size={28} /></div>
        <h1 className="font-serif text-3xl font-bold">دریافت محصول ناموفق بود</h1>
        <p className="text-sm leading-7 text-[#817769]">ارتباط با فروشگاه برقرار نشد. لطفاً دوباره تلاش کنید یا به کاتالوگ محصولات برگردید.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="rounded-full bg-[#b89145] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#9f7936]">تلاش دوباره</button>
          <Link to="/" className="rounded-full border border-[#d9cbb8] px-5 py-3 text-sm font-medium text-[#7d612f]">بازگشت به فروشگاه</Link>
        </div>
      </div>
    </main>
  );
  if (notFound || !product) return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fcfaf7] px-5 text-center text-[#29251f]">
      <div className="flex max-w-md flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4ead8] text-[#a47b32]"><ShoppingBag size={28} /></div>
        <h1 className="font-serif text-3xl font-bold">محصول پیدا نشد</h1>
        <p className="text-sm leading-7 text-[#817769]">این محصول دیگر در کاتالوگ زرین‌سا موجود نیست. محصولات فعال فروشگاه را مشاهده کنید.</p>
        <Link to="/" className="rounded-full bg-[#b89145] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#9f7936]">بازگشت به فروشگاه</Link>
      </div>
    </main>
  );

  const customizationSummary = [customization !== "بدون سفارشی‌سازی" ? customization : "", engraving ? `متن: ${engraving}` : "", stone !== "بدون سنگ" ? stone : "", giftWrap ? "بسته‌بندی هدیه" : ""].filter(Boolean).join(" · ");
  const customizationCost = calculateCustomizationCost(customizationSummary);
  const finalPrice = pricing.total + customizationCost;

  const gallery = [product.image, "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=500&q=85", "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=500&q=85"];

  return (
    <main dir="rtl" className="min-h-screen bg-[#fcfaf7] text-[#29251f]">
      <div className="bg-[#25231f] px-4 py-2 text-center text-xs text-[#e9c982]">قیمت‌ها به‌صورت لحظه‌ای بروزرسانی می‌شوند · ضمانت اصالت برای تمام محصولات</div>
      <header className="border-b border-[#e6dfd4] bg-[#fcfaf7]"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8"><Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b89145] text-white"><Sparkles size={19} /></span><span><span className="block font-serif text-xl font-bold">زرین‌سا</span><span className="block text-[10px] tracking-[0.18em] text-[#9c7a3c]">JEWELRY HOUSE</span></span></Link><div className="flex items-center gap-3"><button onClick={() => setLiked(toggleWishlist(product.id).includes(product.id))} className={`rounded-full p-2.5 ${liked ? "bg-[#b89145] text-white" : "bg-[#f1eadf] text-[#8f6b2e]"}`} aria-label={liked ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}><Heart size={19} fill={liked ? "currentColor" : "none"} /></button><Link to="/" className="flex items-center gap-2 text-sm text-[#756b5e]"><ArrowRight size={17} /> بازگشت به فروشگاه</Link></div></div></header>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-14"><div className="mb-8 flex items-center gap-2 text-xs text-[#9b9184]"><Link to="/" className="hover:text-[#a47b32]">خانه</Link><ChevronLeft size={14} /><span>{product.category}</span><ChevronLeft size={14} /><span className="text-[#4d4439]">{product.name}</span></div>
        <div className="grid gap-10 lg:grid-cols-[1fr_.9fr] lg:gap-16">
          <div className="grid gap-3 sm:grid-cols-[88px_1fr]"><div className="order-2 flex gap-3 overflow-x-auto sm:order-1 sm:flex-col">{gallery.map((image, index) => <button key={image} onClick={() => setSelectedImage(image)} className={`shrink-0 overflow-hidden rounded-xl border-2 ${selectedImage === image ? "border-[#b89145]" : "border-transparent"}`}><img src={image} alt={`${product.name} نمای ${index + 1}`} className="h-20 w-20 object-cover" /></button>)}</div><div className="order-1 overflow-hidden rounded-3xl bg-[#f0ece5] sm:order-2"><img src={selectedImage} alt={product.name} className="aspect-square w-full object-cover" /></div></div>
          <div><Link to={`/verify/${product.id === 1 ? "ZS-VN-0182" : product.id === 2 ? "ZS-AT-0119" : product.id === 3 ? "ZS-HA-0203" : "ZS-NR-0240"}`} className="mb-3 flex w-fit items-center gap-2 text-sm text-[#a47b32] hover:text-[#795a27]"><BadgeCheck size={17} /> مشاهده گواهی اصالت زرین‌سا</Link><h1 className="font-serif text-4xl font-bold text-[#302b24]">{product.name}</h1><div className="mt-4 flex items-center gap-4 text-sm text-[#897e70]"><span>{product.category}</span><span className="h-1 w-1 rounded-full bg-[#cbb99b]" /><span>طلای {number(product.karat)} عیار</span><span className="h-1 w-1 rounded-full bg-[#cbb99b]" /><span>{product.stock > 0 ? `موجودی ${number(product.stock)} عدد` : "ناموجود"}</span></div><p className="mt-6 leading-8 text-[#70675b]">{product.description}</p>
            <div className="mt-7 rounded-2xl border border-[#e9e0d4] bg-white p-5"><div className="mb-4 flex items-center justify-between"><span className="font-medium">محاسبه قیمت شفاف</span><span className={`flex items-center gap-1 text-xs ${snapshot.stale ? "text-[#9b9184]" : "text-[#4eaa76]"}`}><span className={`h-2 w-2 rounded-full ${snapshot.stale ? "bg-[#c9bcae]" : "animate-pulse bg-[#4eaa76]"}`} /> {snapshot.stale ? "آخرین نرخ ذخیره‌شده" : "بروزرسانی لحظه‌ای"}</span></div><div className="space-y-3 text-sm"><div className="flex justify-between text-[#817769]"><span>ارزش طلای خام ({number(product.weight)} گرم)</span><span>{number(pricing.gold)} تومان</span></div><div className="flex justify-between text-[#817769]"><span>اجرت ساخت</span><span>{number(pricing.making)} تومان</span></div><div className="flex justify-between text-[#817769]"><span>سود فروشنده</span><span>{number(pricing.sellerProfit)} تومان</span></div><div className="flex justify-between text-[#817769]"><span>مالیات ارزش افزوده</span><span>{number(pricing.tax)} تومان</span></div><div className="mt-3 flex justify-between border-t border-[#eee7de] pt-4 text-base font-bold"><span>قیمت نهایی</span><span className="text-[#8b682e]">{number(finalPrice)} تومان</span></div></div></div>
            <div className="mt-6 rounded-2xl border border-[#e9e0d4] bg-[#fffdf9] p-5"><div className="mb-4 flex items-center justify-between"><label className="flex items-center gap-2 text-sm font-medium"><Gem size={17} className="text-[#b89145]" /> سفارشی‌سازی محصول</label><span className="text-[11px] text-[#9b9184]">اختیاری</span></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-[#7c7163]">نوع خدمت<select value={customization} onChange={(e) => setCustomization(e.target.value)} className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-4 py-3 text-sm outline-none focus:border-[#b89145]"><option>بدون سفارشی‌سازی</option><option>حکاکی اختصاصی</option></select></label><label className="text-xs text-[#7c7163]">نوع نگین<select value={stone} onChange={(e) => setStone(e.target.value)} className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-4 py-3 text-sm outline-none focus:border-[#b89145]"><option>بدون سنگ</option><option>نگین زیرکونیا</option><option>الماس آزمایشگاهی</option></select></label></div>{customization === "حکاکی اختصاصی" && <label className="mt-4 block text-xs text-[#7c7163]">متن حکاکی<span className="relative mt-2 block"><input value={engraving} onChange={(e) => setEngraving(e.target.value.slice(0, 20))} maxLength={20} placeholder="مثلاً: M &amp; S" className="w-full rounded-xl border border-[#dfd5c7] bg-white px-4 py-3 text-sm outline-none focus:border-[#b89145]" /><span className="absolute left-3 top-3 text-[10px] text-[#a59b8d]">{engraving.length}/۲۰</span></span></label>}<label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-[#70675b]"><input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="h-4 w-4 accent-[#b89145]" /><Gift size={17} className="text-[#b89145]" /> بسته‌بندی هدیه <span className="text-xs text-[#9b9184]">(+۱۵۰٬۰۰۰ تومان)</span></label><div className="mt-4 flex items-start gap-2 rounded-xl bg-[#f8f3eb] p-3 text-[11px] leading-6 text-[#817769]"><Info size={15} className="mt-1 shrink-0 text-[#b89145]" />سفارشی‌سازی معمولاً ۳ تا ۵ روز کاری به زمان آماده‌سازی اضافه می‌کند.</div>{customizationCost > 0 && <div className="mt-4 flex justify-between border-t border-[#eee7de] pt-3 text-sm"><span>هزینه سفارشی‌سازی</span><span className="font-medium text-[#8b682e]">{number(customizationCost)} تومان</span></div>}</div>
            <div className="mt-6 flex gap-3"><div className="flex items-center rounded-xl border border-[#dfd5c7] bg-white"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 text-[#7b6b56]" aria-label="کاهش تعداد"><Minus size={16} /></button><span className="w-8 text-center text-sm">{number(quantity)}</span><button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="p-3 text-[#7b6b56]" aria-label="افزایش تعداد"><Plus size={16} /></button></div><button disabled={product.stock === 0 || quantity > product.stock} onClick={() => { addToCart({ id: product.id, name: product.name, price: finalPrice, weight: product.weight, karat: product.karat, image: product.image, customization: customizationSummary || undefined }, quantity); setAdded(true); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#b89145] px-5 py-3.5 font-medium text-white transition hover:bg-[#9f7936] disabled:cursor-not-allowed disabled:opacity-50">{added ? <><Check size={18} /> به سبد اضافه شد</> : <><ShoppingBag size={18} /> افزودن به سبد خرید</>}</button></div>
            <div className="mt-7 grid gap-3 border-t border-[#e9e0d4] pt-6 text-xs text-[#83786b] sm:grid-cols-3"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#b89145]" /> ضمانت اصالت</div><div className="flex items-center gap-2"><Truck size={17} className="text-[#b89145]" /> ارسال بیمه‌شده</div><div className="flex items-center gap-2"><BadgeCheck size={17} className="text-[#b89145]" /> گواهی دیجیتال</div></div>
          </div>
        </div>
      </div>
      <footer className="border-t border-[#e9e0d4] px-5 py-8 text-center text-xs text-[#948a7d]">© ۱۴۰۴ زرین‌سا · خانه‌ای برای درخشش ماندگار</footer>
    </main>
  );
}
