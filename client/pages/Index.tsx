import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { addToCart, cartEventName, getCart } from "@/lib/cart";
import { GoldPriceSnapshot } from "@shared/gold";
import { products as fallbackProducts } from "@shared/products";
import { getWishlist, toggleWishlist } from "@/lib/wishlist";
import {
  ArrowLeft,
  ArrowUpLeft,
  BadgeCheck,
  Bell,
  Calculator,
  ChevronDown,
  CircleHelp,
  Clock3,
  Filter,
  Heart,
  Menu,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UserRound,
  X,
} from "lucide-react";


type HeaderNotification = { id: string; title: string; text: string; date: string; read: boolean };
const categories = ["همه محصولات", "انگشتر", "گردنبند", "گوشواره", "دستبند"];
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const notificationDate = (value: string) => new Date(value).toLocaleDateString("fa-IR", { month: "short", day: "numeric" });

export default function Index() {
  const [catalog, setCatalog] = useState(fallbackProducts);
  const [activeCategory, setActiveCategory] = useState("همه محصولات");
  const [query, setQuery] = useState("");
  const [wishlist, setWishlist] = useState<number[]>(getWishlist);
  const [cartCount, setCartCount] = useState(0);
  const [goldPrice, setGoldPrice] = useState(3_520_000);
  const [lastUpdated, setLastUpdated] = useState("");
  const [priceSource, setPriceSource] = useState<GoldPriceSnapshot["source"]>("fallback");
  const [weight, setWeight] = useState("2");
  const [karat, setKarat] = useState("18");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [karatFilter, setKaratFilter] = useState("همه عیارها");
  const [weightFilter, setWeightFilter] = useState("همه وزن‌ها");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationNeedsLogin, setNotificationNeedsLogin] = useState(false);
  const [notificationError, setNotificationError] = useState(false);
  const [markingNotification, setMarkingNotification] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.products) setCatalog(data.products); });
    fetch("/api/account/notifications", { credentials: "include" }).then(async (response) => {
      if (response.status === 401) { setNotificationNeedsLogin(true); return null; }
      if (!response.ok) { setNotificationError(true); return null; }
      return response.json() as Promise<{ notifications?: HeaderNotification[] }>;
    }).then((data) => { if (data) setNotifications(data.notifications ?? []); }).catch(() => setNotificationError(true)).finally(() => setNotificationLoading(false));
    const syncCart = () => setCartCount(getCart().reduce((sum, item) => sum + item.quantity, 0));
    const applySnapshot = (snapshot: GoldPriceSnapshot) => {
      if (!Number.isFinite(snapshot.pricePerGram18k) || !snapshot.updatedAt) return;
      setGoldPrice(snapshot.pricePerGram18k);
      setLastUpdated(snapshot.updatedAt);
      setPriceSource(snapshot.source);
    };
    let active = true;
    const refreshGoldPrice = () => {
      fetch("/api/gold-price")
        .then((response) => { if (!response.ok) throw new Error("gold-price-request-failed"); return response.json() as Promise<GoldPriceSnapshot>; })
        .then((snapshot) => { if (active) applySnapshot(snapshot); })
        .catch(() => { if (active) setPriceSource("fallback"); });
    };
    syncCart();
    refreshGoldPrice();
    const priceInterval = window.setInterval(refreshGoldPrice, 15_000);
    window.addEventListener(cartEventName(), syncCart);
    return () => { active = false; window.clearInterval(priceInterval); window.removeEventListener(cartEventName(), syncCart); };
  }, []);

  const visibleProducts = useMemo(() => {
    return catalog.filter((product) => {
      const categoryMatch = activeCategory === "همه محصولات" || product.category === activeCategory;
      const searchMatch = product.name.includes(query) || product.category.includes(query);
      const karatMatch = karatFilter === "همه عیارها" || product.karat === Number(karatFilter);
      const weightMatch = weightFilter === "همه وزن‌ها" || (weightFilter === "تا ۲ گرم" ? product.weight <= 2 : weightFilter === "۲ تا ۴ گرم" ? product.weight > 2 && product.weight <= 4 : product.weight > 4);
      const minPriceMatch = minPrice === 0 || product.price >= minPrice;
      const maxPriceMatch = maxPrice === 0 || product.price <= maxPrice;
      return categoryMatch && searchMatch && karatMatch && weightMatch && minPriceMatch && maxPriceMatch;
    });
  }, [catalog, activeCategory, query, karatFilter, weightFilter, minPrice, maxPrice]);

  const calculatedValue = Math.round((Number(weight || 0) * goldPrice * Number(karat || 0)) / 18);
  const unreadNotifications = notifications.filter((item) => !item.read);

  const markHeaderNotificationAsRead = async (id: string) => {
    setMarkingNotification(id);
    try {
      const response = await fetch(`/api/account/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", credentials: "include" });
      if (response.ok) {
        setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
      } else {
        toast.error("به‌روزرسانی وضعیت اعلان انجام نشد.");
      }
    } catch {
      toast.error("ارتباط با مرکز اعلان‌ها برقرار نشد.");
    } finally {
      setMarkingNotification(null);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#fcfaf7] text-[#29251f]">
      <div className="bg-[#25231f] px-4 py-2 text-center text-xs text-[#e9c982] sm:text-sm">
        ارسال رایگان برای سفارش‌های بالای ۵ میلیون تومان <span className="mx-2 text-white/20">|</span> امکان پرداخت امن و تضمین اصالت
      </div>

      <header className="sticky top-0 z-30 border-b border-[#e6dfd4] bg-[#fcfaf7]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <button className="rounded-xl p-2 lg:hidden" onClick={() => setMobileMenu(!mobileMenu)} aria-label="منو" aria-expanded={mobileMenu} aria-controls="main-navigation">
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b89145] text-[#fffaf0]"><Sparkles size={19} /></div>
            <div><div className="font-serif text-xl font-bold tracking-tight">زرین‌سا</div><div className="text-[10px] tracking-[0.18em] text-[#9c7a3c]">JEWELRY HOUSE</div></div>
          </div>
          <nav id="main-navigation" className={`${mobileMenu ? "absolute right-4 top-[68px] flex" : "hidden"} flex-col gap-5 rounded-2xl border border-[#e8e0d3] bg-[#fffdf9] p-5 shadow-xl lg:static lg:flex lg:flex-row lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}>
            <Link to="/" aria-current="page" className="font-medium text-[#a47b32]">خانه</Link>
            <button className="text-[#625b51] transition hover:text-[#a47b32]" onClick={() => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })}>کالکشن‌ها</button>
            <button className="text-[#625b51] transition hover:text-[#a47b32]" onClick={() => document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" })}>ماشین‌حساب طلا</button>
            <Link to="/size-guide" className="text-[#625b51] transition hover:text-[#a47b32]">راهنمای خرید</Link>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="relative">
              <button onClick={() => setNotificationOpen((open) => !open)} className="relative rounded-full p-2.5 text-[#625b51] hover:bg-[#f2ece2]" aria-label="اعلان‌ها" aria-expanded={notificationOpen} aria-controls="header-notifications"><Bell size={19} />{unreadNotifications.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b89145] px-1 text-[10px] font-medium text-white">{unreadNotifications.length > 9 ? "۹+" : unreadNotifications.length}</span>}</button>
              {notificationOpen && <div id="header-notifications" className="absolute left-0 top-12 z-50 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#e6dccd] bg-[#fffdf9] text-right shadow-2xl" role="dialog" aria-label="اعلان‌های اخیر">
                <div className="flex items-center justify-between border-b border-[#eee6db] px-4 py-3"><div><p className="text-sm font-semibold text-[#3d362d]">اعلان‌های اخیر</p><p className="mt-0.5 text-[11px] text-[#968a7b]">{unreadNotifications.length ? `${number(unreadNotifications.length)} خوانده‌نشده` : "همه خوانده شده‌اند"}</p></div><Bell size={17} className="text-[#b89145]" /></div>
                {notificationLoading ? <div className="px-4 py-8 text-center text-xs text-[#968a7b]">در حال دریافت اعلان‌ها...</div> : notificationNeedsLogin ? <div className="px-4 py-7 text-center"><p className="text-xs leading-6 text-[#817568]">برای مشاهده اعلان‌های شخصی وارد حساب کاربری شوید.</p><Link to="/auth" onClick={() => setNotificationOpen(false)} className="mt-3 inline-flex rounded-full bg-[#b89145] px-4 py-2 text-xs font-medium text-white">ورود به حساب</Link></div> : notificationError ? <div className="px-4 py-7 text-center text-xs text-[#a55b4b]">ارتباط با مرکز اعلان‌ها برقرار نشد.</div> : notifications.length === 0 ? <div className="px-4 py-8 text-center text-xs text-[#968a7b]">اعلان جدیدی ندارید.</div> : <div className="max-h-80 overflow-y-auto">{notifications.slice(0, 4).map((item) => <button key={item.id} onClick={() => void markHeaderNotificationAsRead(item.id)} disabled={markingNotification === item.id} className={`flex w-full gap-3 border-b border-[#f0e9df] px-4 py-3 text-right transition hover:bg-[#faf6ef] ${item.read ? "opacity-75" : "bg-[#fffaf0]"}`}><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-[#d9d0c3]" : "bg-[#b89145]"}`} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-[#50473c]">{item.title}</span><span className="shrink-0 text-[10px] text-[#a09587]">{notificationDate(item.date)}</span></span><span className="mt-1 block line-clamp-2 text-[11px] leading-5 text-[#857a6d]">{item.text}</span></span></button>)}</div>}
                <Link to="/notifications" onClick={() => setNotificationOpen(false)} className="block border-t border-[#eee6db] px-4 py-3 text-center text-xs font-medium text-[#9b742f] hover:bg-[#faf6ef]">مشاهده همه اعلان‌ها</Link>
              </div>}
            </div>
            <Link to="/wishlist" className="relative rounded-full p-2.5 text-[#625b51] hover:bg-[#f2ece2]" aria-label="علاقه‌مندی‌ها"><Heart size={19} fill={wishlist.length > 0 ? "currentColor" : "none"} /></Link><Link to="/auth" className="rounded-full p-2.5 text-[#625b51] hover:bg-[#f2ece2]" aria-label="حساب کاربری"><UserRound size={19} /></Link>
            <Link to="/cart" className="relative rounded-full bg-[#f1eadf] p-2.5 text-[#8f6b2e]" aria-label="سبد خرید"><ShoppingBag size={19} />{cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b89145] px-1 text-[10px] text-white">{cartCount}</span>}</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[#e9e1d6] bg-[#f2ece2]">
        <div className="absolute -left-20 -top-32 h-96 w-96 rounded-full bg-[#d5b16b]/20 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div className="relative z-10 max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#cfb47d]/50 bg-[#fffaf0]/70 px-3 py-1.5 text-xs font-medium text-[#92702f]"><Sparkles size={13} /> کالکشن جدید بهار ۱۴۰۴</div>
            <h1 className="font-serif text-4xl font-bold leading-[1.35] text-[#302b24] sm:text-6xl">درخشش تو،<br /><span className="text-[#ae853e]">امضای ماست.</span></h1>
            <p className="mt-5 max-w-md text-base leading-8 text-[#70675b] sm:text-lg">زیورآلاتی برای لحظه‌هایی که قرار است تا همیشه در خاطر بمانند؛ با قیمت‌گذاری شفاف و تضمین اصالت.</p>
            <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })} className="group flex items-center gap-3 rounded-full bg-[#b89145] px-6 py-3.5 font-medium text-white shadow-lg shadow-[#b89145]/20 transition hover:bg-[#9f7936]">مشاهده کالکشن <ArrowLeft size={17} className="transition group-hover:-translate-x-1" /></button><button onClick={() => document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" })} className="flex items-center gap-2 rounded-full border border-[#cdbb9c] bg-transparent px-5 py-3.5 font-medium text-[#745a2d] hover:bg-white/50"><Calculator size={17} /> قیمت لحظه‌ای طلا</button></div>
            <div className="mt-10 flex items-center gap-6 text-xs text-[#7b7062]"><div className="flex items-center gap-2"><BadgeCheck size={17} className="text-[#b89145]" /> ضمانت اصالت</div><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#b89145]" /> پرداخت امن</div></div>
          </div>
          <div className="relative mx-auto w-full max-w-[480px] lg:ml-0">
            <div className="absolute -inset-3 rounded-[35%] border border-[#d2b371]/40" /><div className="absolute -inset-8 rounded-[35%] border border-[#d2b371]/20" />
            <img className="relative aspect-[.88] w-full rounded-[30%_30%_16%_16%] object-cover shadow-2xl" src="https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1000&q=90" alt="زیورآلات طلایی زرین‌سا" />
            <div className="absolute -bottom-5 -right-5 rounded-2xl border border-[#e7dac5] bg-[#fffdf9] p-4 shadow-xl sm:-right-10"><div className={`mb-1 flex items-center gap-2 text-xs ${priceSource === "fallback" ? "text-[#968a7b]" : "text-[#847565]"}`}><span className={`h-2 w-2 rounded-full ${priceSource === "fallback" ? "bg-[#c9bcae]" : "animate-pulse bg-[#4eaa76]"}`} /> {priceSource === "fallback" ? "آخرین نرخ ذخیره‌شده" : "قیمت لحظه‌ای هر گرم طلا"}</div><div className="font-serif text-xl font-bold text-[#3f372d]">{number(goldPrice)} <span className="text-xs font-normal text-[#887e70]">تومان</span></div><div className={`mt-1 flex items-center gap-1 text-[10px] ${priceSource === "fallback" ? "text-[#968a7b]" : "text-[#4eaa76]"}`}><ArrowUpLeft size={12} /> {priceSource === "fallback" ? "اتصال به منبع قیمت برقرار نیست" : lastUpdated ? `بروزرسانی ${new Date(lastUpdated).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}` : "در حال دریافت نرخ"}</div></div>
          </div>
        </div>
      </section>

      <section id="collection" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-medium text-[#ad843e]">انتخابی برای هر سلیقه</p><h2 className="font-serif text-3xl font-bold sm:text-4xl">محبوب‌ترین‌ها</h2></div><button type="button" onClick={() => { setActiveCategory("همه محصولات"); document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }); }} className="flex items-center gap-2 self-start text-sm font-medium text-[#85652f] sm:self-auto">مشاهده همه <ArrowLeft size={16} /></button></div>
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category} className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm transition ${activeCategory === category ? "bg-[#302b24] text-white" : "border border-[#e2d9cb] bg-white text-[#776e62] hover:border-[#b89145]"}`}>{category}</button>)}</div>
        <div className="mb-7 flex items-center gap-3 rounded-2xl border border-[#e9e0d4] bg-white/70 px-4 py-3"><Search size={19} className="text-[#a28e71]" /><input aria-label="جستجوی محصولات" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-[#a59b8d]" placeholder="جستجوی نام محصول، نوع کالا یا برند..." /><button onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs transition ${showFilters ? "bg-[#302b24] text-white" : "bg-[#f2ede5] text-[#766950]"}`}><Filter size={14} /> فیلتر پیشرفته</button></div>
        {showFilters && <div className="mb-7 grid gap-4 rounded-2xl border border-[#e9e0d4] bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-[#7c7163]">عیار<select value={karatFilter} onChange={(event) => setKaratFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e2d9cb] bg-[#fcfaf7] px-3 py-2.5 text-sm outline-none"><option>همه عیارها</option><option value="18">۱۸ عیار</option><option value="24">۲۴ عیار</option></select></label><label className="text-xs text-[#7c7163]">محدوده وزن<select value={weightFilter} onChange={(event) => setWeightFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e2d9cb] bg-[#fcfaf7] px-3 py-2.5 text-sm outline-none"><option>همه وزن‌ها</option><option>تا ۲ گرم</option><option>۲ تا ۴ گرم</option><option>بیشتر از ۴ گرم</option></select></label><label className="text-xs text-[#7c7163]">حداقل قیمت<input type="number" value={minPrice || ""} onChange={(event) => setMinPrice(Number(event.target.value))} placeholder="مثلاً ۱۰٬۰۰۰٬۰۰۰" className="mt-2 w-full rounded-xl border border-[#e2d9cb] bg-[#fcfaf7] px-3 py-2.5 text-sm outline-none" /></label><label className="text-xs text-[#7c7163]">حداکثر قیمت<input type="number" value={maxPrice || ""} onChange={(event) => setMaxPrice(Number(event.target.value))} placeholder="مثلاً ۵۰٬۰۰۰٬۰۰۰" className="mt-2 w-full rounded-xl border border-[#e2d9cb] bg-[#fcfaf7] px-3 py-2.5 text-sm outline-none" /></label><button onClick={() => { setKaratFilter("همه عیارها"); setWeightFilter("همه وزن‌ها"); setMinPrice(0); setMaxPrice(0); setQuery(""); }} className="text-right text-xs font-medium text-[#a47b32] hover:text-[#76551f] sm:col-span-2 lg:col-span-4">پاک کردن همه فیلترها</button></div>}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">{visibleProducts.map((product) => <article key={product.id} className="group relative"><div className="relative mb-4 overflow-hidden rounded-2xl bg-[#f0ece5]"><Link to={`/product/${product.id}`} aria-label={`مشاهده ${product.name}`}><img src={product.image} alt={product.name} className="aspect-[.9] w-full object-cover transition duration-500 group-hover:scale-105" /></Link>{product.tag && <span className="absolute right-3 top-3 rounded-full bg-[#fffdf9]/90 px-2.5 py-1 text-[10px] font-medium text-[#8b692e]">{product.tag}</span>}<button onClick={() => setWishlist(toggleWishlist(product.id))} className={`absolute left-3 top-3 rounded-full p-2 backdrop-blur-md transition ${wishlist.includes(product.id) ? "bg-[#b89145] text-white" : "bg-white/80 text-[#927a53]"}`} aria-label="افزودن به علاقه‌مندی‌ها"><Heart size={16} fill={wishlist.includes(product.id) ? "currentColor" : "none"} /></button><button onClick={() => addToCart({ id: product.id, name: product.name, price: Math.round(product.weight * goldPrice * (product.karat / 18) * 1.12 * 1.07 * 1.1), weight: product.weight, karat: product.karat, image: product.image })} className="absolute bottom-3 left-3 right-3 translate-y-0 rounded-full bg-[#302b24]/95 py-2.5 text-xs font-medium text-white opacity-100 transition sm:translate-y-14 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">افزودن به سبد</button></div><div className="mb-1 flex items-center justify-between gap-2"><h3 className="font-medium text-[#3e382f]"><Link to={`/product/${product.id}`} className="hover:text-[#a47b32]">{product.name}</Link></h3><div className="flex items-center gap-0.5 text-[10px] text-[#b89145]"><Star size={11} fill="currentColor" /> ۴.۹</div></div><p className="text-xs text-[#9b9184]">{product.weight.toLocaleString("fa-IR")} گرم · طلای {product.karat} عیار</p><p className="mt-2 font-semibold text-[#80602b]">{number(Math.round(product.weight * goldPrice * 1.12 * 1.07 * 1.1))} <span className="text-[10px] font-normal text-[#9b9184]">تومان</span></p></article>)}</div>
        {visibleProducts.length === 0 && <div className="rounded-2xl border border-dashed border-[#d8cbb8] p-10 text-center text-[#857969]">محصولی با این مشخصات پیدا نشد.</div>}
      </section>

      <section id="calculator" className="bg-[#302b24] px-5 py-16 text-white lg:py-20"><div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.8fr_1.2fr] lg:px-8"><div><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b89145] text-white"><Calculator size={23} /></div><p className="mb-2 text-sm text-[#d5b879]">شفافیت، از اولین قدم</p><h2 className="font-serif text-3xl font-bold sm:text-4xl">ارزش طلای خود را<br />همین حالا محاسبه کنید</h2><p className="mt-4 max-w-sm text-sm leading-7 text-[#b9afa1]">قیمت‌ها به‌صورت لحظه‌ای از بازار به‌روزرسانی می‌شوند و هزینه‌ها کاملاً شفاف به شما نمایش داده می‌شوند.</p><div className={`mt-6 flex items-center gap-2 text-xs ${priceSource === "fallback" ? "text-[#a69a8b]" : "text-[#b9afa1]"}`}><span className={`h-2 w-2 rounded-full ${priceSource === "fallback" ? "bg-[#8f8373]" : "animate-pulse bg-[#6bc18d]"}`} /> {priceSource === "fallback" ? "نمایش آخرین نرخ ذخیره‌شده" : `آخرین بروزرسانی: ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "در حال دریافت نرخ"}`}</div></div><div className="rounded-3xl bg-[#3b352d] p-5 sm:p-8"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-[#c5b8a7]">وزن طلا (گرم)<div className="mt-2 flex items-center rounded-xl border border-white/10 bg-[#302b24] px-4"><input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" className="w-full bg-transparent py-3 text-lg text-white outline-none" /><span className="text-xs text-[#8f8373]">گرم</span></div></label><label className="text-sm text-[#c5b8a7]">عیار<div className="relative mt-2"><select value={karat} onChange={(e) => setKarat(e.target.value)} className="w-full appearance-none rounded-xl border border-white/10 bg-[#302b24] px-4 py-3 text-lg text-white outline-none"><option value="24">۲۴ عیار</option><option value="18">۱۸ عیار</option><option value="14">۱۴ عیار</option></select><ChevronDown className="pointer-events-none absolute left-4 top-4 text-[#8f8373]" size={17} /></div></label></div><div className="mt-7 border-t border-white/10 pt-6"><div className="flex items-center justify-between text-sm text-[#c5b8a7]"><span>نرخ هر گرم طلای ۱۸ عیار</span><span>{number(goldPrice)} تومان</span></div><div className="mt-4 flex items-end justify-between"><span className="text-sm text-[#c5b8a7]">ارزش تقریبی طلای شما</span><span className="font-serif text-3xl font-bold text-[#e5c47d]">{number(calculatedValue)} <small className="font-sans text-xs font-normal text-[#b9afa1]">تومان</small></span></div></div></div></div></section>

      <section id="trust" className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[ShieldCheck, "ضمانت اصالت", "گواهی دیجیتال قابل استعلام برای هر قطعه"], [PackageCheck, "بسته‌بندی امن", "ارسال با بیمه کامل و بسته‌بندی اختصاصی"], [Truck, "ارسال سریع", "تحویل مطمئن در سراسر ایران"], [CircleHelp, "مشاوره تخصصی", "همراه شما برای انتخابی مطمئن"]].map(([Icon, title, text]) => <div key={title as string} className="rounded-2xl border border-[#e9e0d4] bg-white p-5"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5eee2] text-[#a27b37]"><Icon size={20} /></div><h3 className="mb-1 font-medium">{title as string}</h3><p className="text-xs leading-6 text-[#8b8174]">{text as string}</p></div>)}</div></section>
      <footer className="border-t border-[#e9e0d4] px-5 py-8 text-center text-xs text-[#948a7d]">© ۱۴۰۴ زرین‌سا · خانه‌ای برای درخشش ماندگار</footer>
    </main>
  );
}
