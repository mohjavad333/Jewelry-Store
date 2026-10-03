import { Link } from "react-router-dom";
import { ArrowRight, Check, CircleHelp, Ruler, Sparkles } from "lucide-react";

const ringSizes = [
  ["۴۸", "۱۵.۳", "انگشت باریک"],
  ["۵۰", "۱۵.۹", "سایز رایج بانوان"],
  ["۵۲", "۱۶.۵", "سایز متوسط بانوان"],
  ["۵۴", "۱۷.۲", "سایز بزرگ بانوان"],
  ["۵۶", "۱۷.۸", "سایز کوچک آقایان"],
  ["۵۸", "۱۸.۴", "سایز متوسط آقایان"],
  ["۶۰", "۱۹.۱", "سایز بزرگ آقایان"],
];

const braceletSizes = [
  ["۱۵", "خیلی ظریف"],
  ["۱۶", "ظریف"],
  ["۱۷", "استاندارد بانوان"],
  ["۱۸", "آزاد بانوان"],
  ["۱۹", "استاندارد آقایان"],
  ["۲۰", "آزاد آقایان"],
  ["۲۱", "دور مچ بزرگ"],
];

export default function SizeGuide() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#fcfaf7] text-[#29251f]">
      <div className="bg-[#25231f] px-4 py-2 text-center text-xs text-[#e9c982]">انتخاب اندازه مناسب، اولین قدم برای یک خرید ماندگار</div>
      <header className="border-b border-[#e6dfd4] bg-[#fcfaf7]"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8"><Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b89145] text-white"><Sparkles size={19} /></span><span><span className="block font-serif text-xl font-bold">زرین‌سا</span><span className="block text-[10px] tracking-[0.18em] text-[#9c7a3c]">JEWELRY HOUSE</span></span></Link><Link to="/" className="flex items-center gap-2 text-sm text-[#756b5e] hover:text-[#a47b32]"><ArrowRight size={17} /> بازگشت به فروشگاه</Link></div></header>

      <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-2xl text-center"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f1e7d5] text-[#a47b32]"><Ruler size={26} /></div><p className="mb-2 text-sm text-[#a47b32]">راهنمای انتخاب اندازه</p><h1 className="font-serif text-3xl font-bold sm:text-5xl">سایز مناسب خود را پیدا کنید</h1><p className="mt-5 text-sm leading-8 text-[#7b7062]">با یک اندازه‌گیری ساده در خانه، انگشتر یا دستبندی را انتخاب کنید که کاملاً روی دست شما بنشیند.</p></div>

        <section className="mt-12 grid gap-5 lg:grid-cols-2"><article className="rounded-3xl border border-[#e9e0d4] bg-white p-6 sm:p-8"><div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5eee2] text-[#a47b32]"><Ruler size={20} /></span><div><h2 className="font-serif text-2xl font-bold">اندازه انگشتر</h2><p className="mt-1 text-xs text-[#958a7b]">قطر داخلی حلقه به میلی‌متر</p></div></div><ol className="space-y-4 text-sm leading-7 text-[#70675b]"><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#302b24] text-xs text-white">۱</span><span>یک انگشتر مناسب را روی خط‌کش بگذارید و قطر داخلی آن را اندازه بگیرید.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#302b24] text-xs text-white">۲</span><span>عدد به‌دست‌آمده را با ستون قطر داخلی مقایسه کنید.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#302b24] text-xs text-white">۳</span><span>اگر بین دو سایز هستید، سایز بزرگ‌تر را انتخاب کنید.</span></li></ol><div className="mt-7 overflow-hidden rounded-2xl border border-[#eee7de]"><table className="w-full text-right text-sm"><thead className="bg-[#f8f3eb] text-xs text-[#806f57]"><tr><th className="px-4 py-3">سایز ایران</th><th className="px-4 py-3">قطر (میلی‌متر)</th><th className="px-4 py-3">مناسب برای</th></tr></thead><tbody>{ringSizes.map(([size, diameter, fit]) => <tr key={size} className="border-t border-[#eee7de]"><td className="px-4 py-3 font-medium text-[#8b682e]">{size}</td><td className="px-4 py-3 text-[#70675b]">{diameter}</td><td className="px-4 py-3 text-xs text-[#958a7b]">{fit}</td></tr>)}</tbody></table></div></article>

          <article className="rounded-3xl border border-[#e9e0d4] bg-white p-6 sm:p-8"><div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5eee2] text-[#a47b32]"><Ruler size={20} /></span><div><h2 className="font-serif text-2xl font-bold">اندازه دستبند</h2><p className="mt-1 text-xs text-[#958a7b]">دور مچ دست به سانتی‌متر</p></div></div><div className="rounded-2xl bg-[#f8f3eb] p-5 text-sm leading-7 text-[#70675b]"><p className="flex gap-2"><Check size={18} className="mt-1 shrink-0 text-[#a47b32]" /> متر پارچه‌ای را دور استخوان مچ، نه خیلی سفت و نه خیلی آزاد، قرار دهید.</p><p className="mt-3 flex gap-2"><Check size={18} className="mt-1 shrink-0 text-[#a47b32]" /> برای مدل‌های ظریف ۱ سانتی‌متر و برای مدل‌های زنجیری ۲ سانتی‌متر به عدد اضافه کنید.</p></div><div className="mt-7 overflow-hidden rounded-2xl border border-[#eee7de]"><table className="w-full text-right text-sm"><thead className="bg-[#f8f3eb] text-xs text-[#806f57]"><tr><th className="px-4 py-3">دور مچ</th><th className="px-4 py-3">حالت پیشنهادی</th></tr></thead><tbody>{braceletSizes.map(([size, fit]) => <tr key={size} className="border-t border-[#eee7de]"><td className="px-4 py-3 font-medium text-[#8b682e]">{size} سانتی‌متر</td><td className="px-4 py-3 text-xs text-[#958a7b]">{fit}</td></tr>)}</tbody></table></div><div className="mt-7 flex gap-3 rounded-2xl border border-[#e9e0d4] p-4 text-xs leading-6 text-[#817769]"><CircleHelp size={18} className="shrink-0 text-[#b89145]" /><span>اگر هنوز مطمئن نیستید، اندازه مچ یا انگشت خود را برای مشاوران زرین‌سا ارسال کنید تا قبل از ثبت سفارش راهنمایی‌تان کنند.</span></div></article></section>

        <div className="mt-10 rounded-3xl bg-[#302b24] p-7 text-center text-white sm:p-10"><p className="text-sm text-[#d5b879]">آماده انتخاب هستید؟</p><h2 className="mt-2 font-serif text-2xl font-bold">قطعه‌ای متناسب با شما منتظر است</h2><Link to="/#collection" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#b89145] px-6 py-3 text-sm font-medium hover:bg-[#9f7936]">مشاهده کالکشن <ArrowRight size={16} /></Link></div>
      </div>
      <footer className="border-t border-[#e9e0d4] px-5 py-8 text-center text-xs text-[#948a7d]">© ۱۴۰۴ زرین‌سا · خانه‌ای برای درخشش ماندگار</footer>
    </main>
  );
}
