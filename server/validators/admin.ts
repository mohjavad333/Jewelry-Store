import { z } from "zod";

export const stockSchema = z.object({ stock: z.number().int().min(0).max(100000) });
export const adminCustomerIdSchema = z.string().trim().min(1).max(120);
export const productSchema = z.object({ name: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(40), weight: z.number().positive().max(1000), karat: z.number().positive().max(24), price: z.number().nonnegative(), image: z.string().url(), description: z.string().trim().min(10).max(500), tag: z.string().trim().max(30).optional(), stock: z.number().int().min(0).max(100000), active: z.boolean() });
export const productUpdateSchema = productSchema.partial();
export const adminLoginSchema = z.object({ key: z.string().min(1).max(200), identifier: z.string().trim().min(3).max(120).optional() });
export const adminCreateSchema = z.object({ name: z.string().trim().min(2).max(80), identifier: z.string().trim().min(3).max(120), key: z.string().min(12).max(200), role: z.enum(["owner", "orders", "products", "reports"]) });
export const adminUpdateSchema = z.object({ name: z.string().trim().min(2).max(80).optional(), identifier: z.string().trim().min(3).max(120).optional(), key: z.string().min(12).max(200).optional(), role: z.enum(["owner", "orders", "products", "reports"]).optional(), active: z.boolean().optional() });

export const adminRoles = { owner: { title: "مدیر ارشد", permissions: ["همه دسترسی‌ها"] }, orders: { title: "مدیر سفارش‌ها", permissions: ["مشاهده سفارش‌ها", "تغییر وضعیت سفارش‌ها", "مدیریت رهگیری"] }, products: { title: "مدیر محصولات", permissions: ["ایجاد و ویرایش محصول", "مدیریت موجودی"] }, reports: { title: "مدیر گزارش‌ها", permissions: ["مشاهده گزارش فروش", "مشاهده مشتریان"] } } as const;
