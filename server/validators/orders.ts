import { z } from "zod";

export const addressSchema = z.object({ id: z.string(), title: z.string(), receiver: z.string(), phone: z.string(), details: z.string(), postalCode: z.string() });
export const itemSchema = z.object({ id: z.number(), name: z.string().min(1), weight: z.number().positive(), karat: z.number().positive().default(18), quantity: z.number().int().positive(), image: z.string().url(), customization: z.string().optional() });
export const orderSchema = z.object({ idempotencyKey: z.string().min(8).max(80), address: addressSchema, items: z.array(itemSchema).min(1), insurance: z.boolean(), paymentMethod: z.string().min(1) });
export const orderUpdateSchema = z.object({ status: z.enum(["در انتظار پرداخت", "پرداخت شده", "در حال آماده‌سازی", "آماده ارسال", "ارسال شده", "تحویل شده", "لغو شده"]), tracking: z.string().trim().min(5).max(30).optional(), note: z.string().trim().max(500).optional() }).partial().refine((value) => value.status || value.tracking || value.note !== undefined, "حداقل یک تغییر لازم است.");
