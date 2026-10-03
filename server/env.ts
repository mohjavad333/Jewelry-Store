import "dotenv/config";
import { z } from "zod";

const productionSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  ADMIN_API_KEY: z.string().min(32).refine((value) => !value.toLowerCase().includes("replace-with"), "ADMIN_API_KEY must be a real secret."),
  CLIENT_ORIGIN: z.string().url().startsWith("https://"),
  ADMIN_API_ROLE: z.enum(["owner", "orders", "products", "reports"]).optional(),
});

export function isProductionLikeEnvironment() {
  return process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
}

export function validateProductionEnvironment() {
  if (!isProductionLikeEnvironment()) return;
  const parsed = productionSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Production-like environment is invalid. Check: ${missing}`);
  }
}
