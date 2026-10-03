import { z } from "zod";

export const challengeSchema = z.object({ identifier: z.string().trim().min(3).max(120), mode: z.enum(["login", "register"]), name: z.string().trim().min(2).max(80).optional() });
export const verifySchema = z.object({ challengeId: z.string().min(20), code: z.string().regex(/^\d{6}$/) });
export const profileSchema = z.object({ name: z.string().trim().min(2).max(80) });
export const addressSchema = z.object({ title: z.string().trim().min(1).max(40), receiver: z.string().trim().min(2).max(80), phone: z.string().trim().min(7).max(20), details: z.string().trim().min(5).max(300), postalCode: z.string().trim().min(5).max(20) });

export type AddressInput = z.infer<typeof addressSchema>;
