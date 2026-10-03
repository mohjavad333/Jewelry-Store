export type Product = {
  id: number;
  name: string;
  category: string;
  weight: number;
  karat: number;
  price: number;
  image: string;
  description: string;
  tag?: string;
  stock: number;
  active: boolean;
};

export const products: Product[] = [
  { id: 1, name: "گردنبند ونوس", category: "گردنبند", weight: 3.42, karat: 18, price: 29_840_000, image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=90", description: "زنجیری ظریف و چشم‌نواز با طراحی الهام‌گرفته از نور و حرکت؛ انتخابی ماندگار برای استفاده روزمره و مهمانی.", tag: "پرفروش", stock: 8, active: true },
  { id: 2, name: "انگشتر مینیمال آتنا", category: "انگشتر", weight: 1.86, karat: 18, price: 16_290_000, image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=90", description: "فرمی مینیمال با پرداخت آینه‌ای و خطوطی نرم که به‌سادگی با استایل روزانه شما هماهنگ می‌شود.", tag: "جدید", stock: 5, active: true },
  { id: 3, name: "گوشواره هاله", category: "گوشواره", weight: 2.15, karat: 18, price: 20_450_000, image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1200&q=90", description: "گوشواره‌ای سبک با درخشش لطیف که برای ساختن یک استایل ظریف و متفاوت طراحی شده است.", stock: 12, active: true },
  { id: 4, name: "دستبند زنجیری نور", category: "دستبند", weight: 4.8, karat: 18, price: 41_780_000, image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1200&q=90", description: "دستبندی با بافت زنجیری کلاسیک و قفل ایمن؛ ترکیبی از ظرافت، دوام و درخشش همیشگی.", stock: 3, active: true },
];
