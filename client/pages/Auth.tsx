import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronLeft,
  FileText,
  LogOut,
  Mail,
  MapPin,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";

export type UserProfile = {
  id?: string;
  name: string;
  identifier: string;
  joinedAt: string;
};
type Address = {
  id: string;
  title: string;
  receiver: string;
  phone: string;
  details: string;
  postalCode: string;
};
type Order = {
  id: string;
  date: string;
  amount: number;
  status: string;
  tracking: string;
  items: string;
};
type ApiOrder = {
  id: string;
  date: string;
  tracking: string;
  status: string;
  totals: { total: number };
  items: Array<{ name: string }>;
};

const USER_KEY = "zarinsa-user";
const ADDRESS_KEY = "zarinsa-addresses";
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("fa-IR");

function getUser(): UserProfile | null {
  try {
    const user = window.localStorage.getItem(USER_KEY);
    return user ? (JSON.parse(user) as UserProfile) : null;
  } catch {
    return null;
  }
}

function getAddresses(): Address[] {
  try {
    const value = window.localStorage.getItem(ADDRESS_KEY);
    return value ? (JSON.parse(value) as Address[]) : [];
  } catch {
    return [];
  }
}

function mapOrders(items: ApiOrder[]): Order[] {
  return items.map((order) => ({
    id: order.id,
    date: formatDate(order.date),
    amount: order.totals.total,
    status: order.status,
    tracking: order.tracking,
    items: order.items.map((item) => item.name).join("، "),
  }));
}

export default function Auth() {
  const [user, setUser] = useState<UserProfile | null>(getUser);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"profile" | "addresses" | "orders">("profile");
  const [addresses, setAddresses] = useState<Address[]>(getAddresses);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(() => getUser()?.name ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [address, setAddress] = useState({
    title: "خانه",
    receiver: "",
    phone: "",
    details: "",
    postalCode: "",
  });

  const loadAccount = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = (await response.json()) as {
        user: UserProfile;
        addresses: Address[];
      };
      setUser(data.user);
      setProfileName(data.user.name);
      setAddresses(data.addresses ?? []);
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      window.localStorage.setItem(
        ADDRESS_KEY,
        JSON.stringify(data.addresses ?? []),
      );
      const ordersResponse = await fetch("/api/account/orders", {
        credentials: "include",
      });
      if (ordersResponse.ok) {
        const ordersData = (await ordersResponse.json()) as {
          orders: ApiOrder[];
        };
        setOrders(mapOrders(ordersData.orders ?? []));
      }
    } catch {
      setNotice("ارتباط با حساب کاربری برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccount();
  }, []);

  const demoLogin = async () => {
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/demo-login", {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as {
        user?: UserProfile;
        addresses?: Address[];
        message?: string;
      };
      if (!response.ok || !data.user) {
        setNotice(data.message ?? "ورود دمو در دسترس نیست.");
        return;
      }
      setUser(data.user);
      setProfileName(data.user.name);
      setAddresses(data.addresses ?? []);
      setTab("profile");
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      window.localStorage.setItem(
        ADDRESS_KEY,
        JSON.stringify(data.addresses ?? []),
      );
      toast.success("با حساب دمو وارد شدید.");
      setNotice("با حساب دمو وارد شدید.");
      await loadAccount();
    } catch {
      setNotice("ارتباط با ورود دمو برقرار نشد.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || (mode === "register" && !name.trim())) {
      setNotice("اطلاعات لازم را کامل کنید.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          mode,
          ...(mode === "register" ? { name: name.trim() } : {}),
        }),
      });
      const data = (await response.json()) as {
        challengeId?: string;
        devCode?: string;
        message?: string;
      };
      if (!response.ok) {
        setNotice(data.message ?? "ارسال کد تأیید انجام نشد.");
        return;
      }
      setChallengeId(data.challengeId ?? "");
      setStep("code");
      setNotice(
        `کد تأیید به ${identifier} ارسال شد${data.devCode ? ` · کد تست: ${data.devCode}` : ""}`,
      );
    } catch {
      setNotice("ارتباط با سرویس ورود برقرار نشد.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !challengeId) {
      setNotice("کد تأیید را وارد کنید.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challengeId, code: code.trim() }),
      });
      const data = (await response.json()) as {
        user?: UserProfile;
        addresses?: Address[];
        message?: string;
      };
      if (!response.ok || !data.user) {
        setNotice(data.message ?? "کد تأیید نادرست است.");
        return;
      }
      setUser(data.user);
      setProfileName(data.user.name);
      setAddresses(data.addresses ?? []);
      setOrders([]);
      setTab("profile");
      setStep("identifier");
      setCode("");
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      window.localStorage.setItem(
        ADDRESS_KEY,
        JSON.stringify(data.addresses ?? []),
      );
      toast.success("ورود شما با موفقیت انجام شد.");
      setNotice("ورود شما با موفقیت انجام شد.");
      await loadAccount();
    } catch {
      setNotice("تأیید ورود انجام نشد. دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(ADDRESS_KEY);
    setUser(null);
    setOrders([]);
    setAddresses([]);
    setStep("identifier");
    setIdentifier("");
    setCode("");
    toast.success("از حساب کاربری خارج شدید.");
    setNotice("از حساب کاربری خارج شدید.");
  };

  const updateProfile = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = profileName.trim();
    if (nextName.length < 2) {
      setNotice("نام و نام خانوادگی باید حداقل دو حرف داشته باشد.");
      return;
    }
    setProfileSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nextName }),
      });
      const data = (await response.json()) as {
        user?: UserProfile;
        message?: string;
      };
      if (!response.ok || !data.user) {
        setNotice(data.message ?? "ذخیره پروفایل انجام نشد.");
        return;
      }
      setUser(data.user);
      setProfileName(data.user.name);
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      toast.success("پروفایل با موفقیت به‌روزرسانی شد.");
      setNotice("پروفایل با موفقیت به‌روزرسانی شد.");
    } catch {
      setNotice("ارتباط با سرویس حساب کاربری برقرار نشد.");
    } finally {
      setProfileSaving(false);
    }
  };

  const updateAddress = (field: keyof typeof address, value: string) =>
    setAddress((current) => ({ ...current, [field]: value }));

  const saveAddress = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !address.receiver ||
      !address.phone ||
      !address.details ||
      !address.postalCode
    ) {
      setNotice("همه اطلاعات آدرس را کامل کنید.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch(
        editingAddressId
          ? `/api/account/addresses/${encodeURIComponent(editingAddressId)}`
          : "/api/account/addresses",
        {
          method: editingAddressId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(address),
        },
      );
      const data = (await response.json()) as {
        address?: Address;
        message?: string;
      };
      if (!response.ok || !data.address) {
        setNotice(data.message ?? "ذخیره آدرس انجام نشد.");
        return;
      }
      const next = editingAddressId
        ? addresses.map((item) =>
            item.id === data.address?.id ? data.address : item,
          )
        : [...addresses, data.address];
      setAddresses(next);
      window.localStorage.setItem(ADDRESS_KEY, JSON.stringify(next));
      setAddress({
        title: "خانه",
        receiver: "",
        phone: "",
        details: "",
        postalCode: "",
      });
      setEditingAddressId(null);
      setShowAddressForm(false);
      toast.success(
        editingAddressId ? "آدرس با موفقیت ویرایش شد." : "آدرس با موفقیت ذخیره شد.",
      );
      setNotice(
        editingAddressId ? "آدرس با موفقیت ویرایش شد." : "آدرس با موفقیت ذخیره شد.",
      );
    } catch {
      setNotice("ارتباط با سرویس آدرس برقرار نشد.");
    } finally {
      setSubmitting(false);
    }
  };

  const editAddress = (item: Address) => {
    setAddress({
      title: item.title,
      receiver: item.receiver,
      phone: item.phone,
      details: item.details,
      postalCode: item.postalCode,
    });
    setEditingAddressId(item.id);
    setShowAddressForm(true);
    setNotice("");
  };

  const closeAddressForm = () => {
    setEditingAddressId(null);
    setShowAddressForm(false);
    setAddress({
      title: "خانه",
      receiver: "",
      phone: "",
      details: "",
      postalCode: "",
    });
  };

  const removeAddress = async (id: string) => {
    const response = await fetch(
      `/api/account/addresses/${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!response.ok) {
      setNotice("حذف آدرس انجام نشد.");
      return;
    }
    const next = addresses.filter((item) => item.id !== id);
    setAddresses(next);
    window.localStorage.setItem(ADDRESS_KEY, JSON.stringify(next));
    toast.success("آدرس حذف شد.");
    setNotice("آدرس حذف شد.");
  };

  const cancelOrder = async (id: string) => {
    if (!window.confirm("آیا از لغو این سفارش مطمئن هستید؟")) return;
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/account/orders/${encodeURIComponent(id)}/cancel`,
        { method: "POST", credentials: "include" },
      );
      const data = (await response.json()) as {
        order?: ApiOrder;
        message?: string;
      };
      if (!response.ok) {
        setNotice(data.message ?? "لغو سفارش انجام نشد.");
        return;
      }
      setOrders((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status: data.order?.status ?? "لغو شده" }
            : item,
        ),
      );
      toast.success("سفارش لغو شد و موجودی آزاد شد.");
      setNotice("سفارش لغو شد و موجودی آزاد شد.");
    } catch {
      setNotice("ارتباط با سرویس سفارش برقرار نشد.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#fcfaf7] text-[#29251f]">
      <div className="bg-[#25231f] px-4 py-2 text-center text-xs text-[#e9c982]">
        حساب کاربری زرین‌سا · تجربه خرید شخصی و امن
      </div>
      <header className="border-b border-[#e6dfd4] bg-[#fcfaf7]">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b89145] text-white">
              <Sparkles size={19} />
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
            <ArrowRight size={17} /> بازگشت به فروشگاه
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-16">
        {loading ? (
          <div className="rounded-3xl border border-[#e9e0d4] bg-white p-16 text-center text-sm text-[#817769]">
            در حال بررسی حساب کاربری...
          </div>
        ) : !user ? (
          <section className="mx-auto max-w-xl rounded-3xl border border-[#e9e0d4] bg-white p-7 shadow-sm sm:p-10">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3eadc] text-[#b89145]">
                <UserRound size={25} />
              </div>
              <p className="mb-2 text-sm text-[#a47b32]">
                ورود به تجربه شخصی زرین‌سا
              </p>
              <h1 className="font-serif text-3xl font-bold">حساب کاربری</h1>
            </div>
            {notice && (
              <div role="alert" aria-live="assertive" className="mb-5 rounded-xl bg-[#fff3ed] p-3 text-center text-sm text-[#a55b4b]">
                {notice}
              </div>
            )}
            {step === "identifier" ? (
              <form onSubmit={requestCode} className="space-y-4">
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f7f3ed] p-1">
                  <button
                    type="button"
                    onClick={() => setMethod("phone")}
                    aria-pressed={method === "phone"}
                    className={`rounded-lg py-2.5 text-sm ${method === "phone" ? "bg-white font-medium text-[#8c682e] shadow-sm" : "text-[#887e70]"}`}
                  >
                    <Phone className="ml-1 inline" size={15} /> شماره موبایل
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("email")}
                    aria-pressed={method === "email"}
                    className={`rounded-lg py-2.5 text-sm ${method === "email" ? "bg-white font-medium text-[#8c682e] shadow-sm" : "text-[#887e70]"}`}
                  >
                    <Mail className="ml-1 inline" size={15} /> ایمیل
                  </button>
                </div>
                {mode === "register" && (
                  <label className="block text-xs text-[#756b5e]">
                    نام و نام خانوادگی
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      className="mt-2 w-full rounded-xl border border-[#dfd5c7] px-4 py-3 text-sm outline-none focus:border-[#b89145]"
                    />
                  </label>
                )}
                {
                  <label className="block text-xs text-[#756b5e]">
                    {method === "email" ? "ایمیل" : "شماره موبایل"}
                    <input
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      type={method === "email" ? "email" : "tel"}
                      autoComplete={method === "email" ? "email" : "tel"}
                      dir="ltr"
                      className="mt-2 w-full rounded-xl border border-[#dfd5c7] px-4 py-3 text-left text-sm outline-none focus:border-[#b89145]"
                    />
                  </label>
                }
                {notice && <p role="alert" aria-live="assertive" className="text-sm text-[#a55b4b]">{notice}</p>}
                <button
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#302b24] py-3.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submitting ? "در حال ارسال..." : "دریافت کد تأیید"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "register" : "login");
                    setNotice("");
                  }}
                  className="w-full text-sm text-[#987333]"
                >
                  {mode === "login"
                    ? "حساب کاربری ندارید؟ ثبت‌نام کنید"
                    : "قبلاً ثبت‌نام کرده‌اید؟ وارد شوید"}
                </button>
                {import.meta.env.DEV && (
                  <>
                    <div className="flex items-center gap-3 py-1 text-xs text-[#b0a496]">
                      <span className="h-px flex-1 bg-[#e9e0d4]" /> یا{" "}
                      <span className="h-px flex-1 bg-[#e9e0d4]" />
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void demoLogin()}
                      className="w-full rounded-xl border border-[#b89145] py-3 text-sm text-[#8b682e] disabled:opacity-60"
                    >
                      {submitting ? "در حال ورود..." : "ورود دمو بدون کد"}
                    </button>
                  </>
                )}
              </form>
            ) : (
              <form onSubmit={verifyCode} className="space-y-4">
                <div id="verification-instructions" className="rounded-2xl bg-[#f7f3ed] p-4 text-center text-sm text-[#756b5e]">
                  کد شش‌رقمی ارسال‌شده برای{" "}
                  <strong dir="ltr">{identifier}</strong> را وارد کنید.
                </div>
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  aria-label="کد تأیید شش‌رقمی"
                  aria-describedby="verification-instructions"
                  autoComplete="one-time-code"
                  dir="ltr"
                  maxLength={6}
                  placeholder="------"
                  className="w-full rounded-xl border border-[#dfd5c7] px-4 py-4 text-center text-2xl tracking-[0.5em] outline-none focus:border-[#b89145]"
                />
                {notice && <p role="alert" aria-live="assertive" className="text-sm text-[#a55b4b]">{notice}</p>}
                <button
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#302b24] py-3.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submitting ? "در حال بررسی..." : "تأیید و ورود"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("identifier");
                    setCode("");
                    setNotice("");
                  }}
                  className="flex w-full items-center justify-center gap-1 text-sm text-[#987333]"
                >
                  <ChevronLeft size={16} /> اصلاح اطلاعات
                </button>
              </form>
            )}
          </section>
        ) : (
          <div className="grid gap-7 lg:grid-cols-[.7fr_1.3fr]">
            <section className="rounded-3xl bg-[#302b24] p-7 text-white sm:p-9">
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b89145]">
                <UserRound size={26} />
              </div>
              <p className="text-sm text-[#d5b879]">خوش آمدید</p>
              <h1 className="mt-2 font-serif text-3xl font-bold">
                {user.name}
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#c4b8a9]">
                حساب شما آماده مدیریت سفارش‌ها و آدرس‌های تحویل است.
              </p>
              <div className="mt-9 space-y-2">
                <button
                  onClick={() => setTab("profile")}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm ${tab === "profile" ? "bg-white/10 text-[#e5c47d]" : "text-[#c4b8a9]"}`}
                >
                  اطلاعات حساب <UserRound size={16} />
                </button>
                <button
                  onClick={() => setTab("orders")}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm ${tab === "orders" ? "bg-white/10 text-[#e5c47d]" : "text-[#c4b8a9]"}`}
                >
                  سفارش‌های من <PackageCheck size={16} />
                </button>
                <button
                  onClick={() => setTab("addresses")}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm ${tab === "addresses" ? "bg-white/10 text-[#e5c47d]" : "text-[#c4b8a9]"}`}
                >
                  آدرس‌های تحویل <MapPin size={16} />
                </button>
                <Link
                  to="/notifications"
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm text-[#c4b8a9]"
                >
                  اعلان‌های من <Bell size={16} />
                </Link>
              </div>
              <button
                onClick={() => void logout()}
                className="mt-8 flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-[#ddd2c4] hover:bg-white/5"
              >
                <LogOut size={17} /> خروج از حساب
              </button>
            </section>
            <section className="rounded-3xl border border-[#e9e0d4] bg-white p-6 sm:p-8">
              {notice && (
                <div role="status" aria-live="polite" className="mb-6 rounded-xl bg-[#f0f7f1] p-3 text-sm text-[#4d8c63]">
                  {notice}
                </div>
              )}
              {tab === "profile" && (
                <>
                  <div className="mb-7 flex items-center justify-between">
                    <div>
                      <p className="mb-1 text-sm text-[#a47b32]">پروفایل من</p>
                      <h2 className="font-serif text-2xl font-bold">
                        اطلاعات حساب
                      </h2>
                    </div>
                    <BadgeCheck className="text-[#b89145]" />
                  </div>
                  <form
                    onSubmit={updateProfile}
                    className="mb-6 rounded-2xl border border-[#e9e0d4] bg-[#fcfaf7] p-4"
                  >
                    <label className="block text-xs text-[#7c7163]">
                      نام و نام خانوادگی
                      <input
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-4 py-3 text-sm outline-none focus:border-[#b89145]"
                        maxLength={80}
                        required
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[#8b8174]">
                        شماره یا ایمیل ورود برای حفظ امنیت قابل تغییر نیست.
                      </p>
                      <button
                        disabled={profileSaving}
                        className="rounded-xl bg-[#b89145] px-4 py-2.5 text-xs font-medium text-white disabled:opacity-60"
                      >
                        {profileSaving ? "در حال ذخیره..." : "ذخیره تغییرات"}
                      </button>
                    </div>
                  </form>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#fcfaf7] p-4">
                      <div className="mb-3 flex items-center gap-2 text-xs text-[#8c8173]">
                        <UserRound size={16} className="text-[#b89145]" /> نام و
                        نام خانوادگی
                      </div>
                      <p className="font-medium">{user.name}</p>
                    </div>
                    <div className="rounded-2xl bg-[#fcfaf7] p-4">
                      <div className="mb-3 flex items-center gap-2 text-xs text-[#8c8173]">
                        {user.identifier.includes("@") ? (
                          <Mail size={16} className="text-[#b89145]" />
                        ) : (
                          <Phone size={16} className="text-[#b89145]" />
                        )}{" "}
                        راه ارتباطی
                      </div>
                      <p dir="ltr" className="text-left font-medium">
                        {user.identifier}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#fcfaf7] p-4">
                      <div className="mb-3 flex items-center gap-2 text-xs text-[#8c8173]">
                        <Check size={16} className="text-[#b89145]" /> عضو از
                      </div>
                      <p className="font-medium">{formatDate(user.joinedAt)}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3 rounded-2xl border border-[#e9e0d4] p-5">
                    <ShieldCheck
                      size={20}
                      className="shrink-0 text-[#b89145]"
                    />
                    <div>
                      <div className="text-sm font-medium">امنیت حساب</div>
                      <p className="mt-2 text-xs leading-6 text-[#8b8174]">
                        ورود شما با کد یک‌بارمصرف انجام می‌شود و نشست حساب
                        به‌صورت امن در مرورگر نگهداری می‌شود.
                      </p>
                    </div>
                  </div>
                </>
              )}
              {tab === "addresses" && (
                <>
                  <div className="mb-7 flex items-center justify-between">
                    <div>
                      <p className="mb-1 text-sm text-[#a47b32]">
                        مقصدهای ذخیره‌شده
                      </p>
                      <h2 className="font-serif text-2xl font-bold">
                        آدرس‌های تحویل
                      </h2>
                    </div>
                    <button
                      onClick={() => showAddressForm ? closeAddressForm() : setShowAddressForm(true)}
                      aria-expanded={showAddressForm}
                      className="flex items-center gap-1 rounded-xl bg-[#302b24] px-3 py-2.5 text-xs text-white"
                    >
                      {showAddressForm ? <X size={15} /> : <Plus size={15} />}{" "}
                      {showAddressForm ? "بستن" : editingAddressId ? "ویرایش آدرس" : "افزودن آدرس"}
                    </button>
                  </div>
                  {showAddressForm && (
                    <form
                      onSubmit={saveAddress}
                      className="mb-6 grid gap-3 rounded-2xl bg-[#fcfaf7] p-4 sm:grid-cols-2"
                    >
                      <label className="text-xs text-[#70675b]">
                        عنوان آدرس
                        <input
                          value={address.title}
                          onChange={(event) =>
                            updateAddress("title", event.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-2.5 text-sm outline-none"
                        />
                      </label>
                      <label className="text-xs text-[#70675b]">
                        نام گیرنده
                        <input
                          value={address.receiver}
                          onChange={(event) =>
                            updateAddress("receiver", event.target.value)
                          }
                          autoComplete="name"
                          className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-2.5 text-sm outline-none"
                        />
                      </label>
                      <label className="text-xs text-[#70675b]">
                        شماره تماس گیرنده
                        <input
                          value={address.phone}
                          onChange={(event) =>
                            updateAddress("phone", event.target.value)
                          }
                          autoComplete="tel"
                          dir="ltr"
                          className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-2.5 text-left text-sm outline-none"
                        />
                      </label>
                      <label className="text-xs text-[#70675b]">
                        کد پستی
                        <input
                          value={address.postalCode}
                          onChange={(event) =>
                            updateAddress("postalCode", event.target.value)
                          }
                          autoComplete="postal-code"
                          dir="ltr"
                          className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-2.5 text-left text-sm outline-none"
                        />
                      </label>
                      <label className="text-xs text-[#70675b] sm:col-span-2">
                        نشانی کامل
                        <textarea
                          value={address.details}
                          onChange={(event) =>
                            updateAddress("details", event.target.value)
                          }
                          autoComplete="street-address"
                          rows={3}
                          className="mt-2 w-full rounded-xl border border-[#dfd5c7] bg-white px-3 py-2.5 text-sm outline-none"
                        />
                      </label>
                      <button
                        disabled={submitting}
                        className="rounded-xl bg-[#b89145] px-4 py-3 text-sm text-white disabled:opacity-60 sm:col-span-2"
                      >
                        {submitting ? "در حال ذخیره..." : editingAddressId ? "ذخیره ویرایش" : "ذخیره آدرس"}
                      </button>
                    </form>
                  )}
                  {addresses.length === 0 && !showAddressForm ? (
                    <div className="rounded-2xl border border-dashed border-[#d8cbb8] p-12 text-center text-sm text-[#958a7b]">
                      هنوز آدرسی ثبت نکرده‌اید.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {addresses.map((item) => (
                        <article
                          key={item.id}
                          className="flex items-start justify-between gap-4 rounded-2xl border border-[#e9e0d4] p-4"
                        >
                          <div className="flex gap-3">
                            <MapPin
                              className="mt-1 shrink-0 text-[#b89145]"
                              size={18}
                            />
                            <div>
                              <h3 className="font-medium">{item.title}</h3>
                              <p className="mt-1 text-sm text-[#625b51]">
                                {item.receiver} · {item.phone}
                              </p>
                              <p className="mt-2 text-xs leading-6 text-[#8b8174]">
                                {item.details}
                              </p>
                              <p className="mt-1 text-xs text-[#a47b32]">
                                کد پستی: {item.postalCode}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => editAddress(item)}
                              aria-label={`ویرایش آدرس ${item.title}`}
                              className="rounded-lg p-2 text-[#92713a] hover:bg-[#f7f0e3]"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => void removeAddress(item.id)}
                              aria-label={`حذف آدرس ${item.title}`}
                              className="rounded-lg p-2 text-[#a55b4b] hover:bg-[#fff3ed]"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
              {tab === "orders" && (
                <>
                  <div className="mb-7 flex items-center justify-between">
                    <div>
                      <p className="mb-1 text-sm text-[#a47b32]">خریدهای من</p>
                      <h2 className="font-serif text-2xl font-bold">
                        تاریخچه سفارش‌ها
                      </h2>
                    </div>
                    <PackageCheck className="text-[#b89145]" />
                  </div>
                  {orders.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#d8cbb8] p-12 text-center text-sm text-[#958a7b]">
                      هنوز سفارشی ثبت نکرده‌اید.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <article
                          key={order.id}
                          className="rounded-2xl border border-[#e9e0d4] p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{order.id}</h3>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] ${order.status === "لغو شده" ? "bg-[#fff0ed] text-[#a55b4b]" : order.status === "تحویل شده" ? "bg-[#eaf6ee] text-[#4c9062]" : "bg-[#f8f0df] text-[#956f2d]"}`}
                                >
                                  {order.status}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-[#8b8174]">
                                {order.date} · {order.items}
                              </p>
                            </div>
                            <strong className="text-[#8b682e]">
                              {number(order.amount)} تومان
                            </strong>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eee7de] pt-4">
                            <Link
                              to={`/account/orders/${encodeURIComponent(order.id)}`}
                              className="flex items-center gap-1 rounded-lg bg-[#302b24] px-3 py-2 text-xs text-white"
                            >
                              <PackageCheck size={14} /> جزئیات سفارش
                            </Link>
                            <Link
                              to={`/invoice/${encodeURIComponent(order.id)}`}
                              className="flex items-center gap-1 rounded-lg border border-[#dfd5c7] px-3 py-2 text-xs text-[#756b5e]"
                            >
                              <FileText size={14} /> فاکتور
                            </Link>
                            {order.tracking && (
                              <Link
                                to={`/track/${encodeURIComponent(order.tracking)}`}
                                className="flex items-center gap-1 rounded-lg border border-[#dfd5c7] px-3 py-2 text-xs text-[#756b5e]"
                              >
                                <Truck size={14} /> رهگیری
                              </Link>
                            )}
                            {order.status === "در انتظار پرداخت" && (
                              <button
                                disabled={submitting}
                                onClick={() => void cancelOrder(order.id)}
                                className="rounded-lg border border-[#edcfc8] px-3 py-2 text-xs text-[#a55b4b] disabled:opacity-50"
                              >
                                لغو سفارش
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
      <footer className="border-t border-[#e9e0d4] px-5 py-8 text-center text-xs text-[#948a7d]">
        حساب کاربری زرین‌سا · خریدی امن و ماندگار
      </footer>
    </main>
  );
}
