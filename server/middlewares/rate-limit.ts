import type { NextFunction, Request, RequestHandler, Response } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  key: (req: Request) => string;
  message: string;
};

type Bucket = { count: number; resetAt: number };

function clientAddress(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export const byIp = (req: Request) => clientAddress(req);
export const byIdentifier = (req: Request) => String(req.body?.identifier ?? "").trim().toLowerCase() || clientAddress(req);
export const byChallenge = (req: Request) => String(req.body?.challengeId ?? "").trim() || clientAddress(req);

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = options.key(req);
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + options.windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);

    if (buckets.size > 5000) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
      }
    }

    res.setHeader("RateLimit-Limit", options.max);
    res.setHeader("RateLimit-Remaining", Math.max(0, options.max - bucket.count));
    res.setHeader("RateLimit-Reset", Math.ceil((bucket.resetAt - now) / 1000));
    if (bucket.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ message: options.message });
      return;
    }
    next();
  };
}

export const otpRequestByIp = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: byIp, message: "تعداد درخواست‌های ورود زیاد است. چند دقیقه بعد دوباره تلاش کنید." });
export const otpRequestByIdentifier = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, key: byIdentifier, message: "برای این شماره یا ایمیل درخواست‌های زیادی ثبت شده است." });
export const otpVerifyByIp = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, key: byIp, message: "تعداد تلاش‌های ورود زیاد است. چند دقیقه بعد دوباره تلاش کنید." });
export const otpVerifyByChallenge = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, key: byChallenge, message: "تعداد تلاش برای این کد زیاد است." });
export const adminLoginByIp = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: byIp, message: "تعداد تلاش‌های ورود مدیریت زیاد است. چند دقیقه بعد دوباره تلاش کنید." });
export const adminLoginByIdentifier = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, key: byIdentifier, message: "تعداد تلاش برای این شناسه مدیریت زیاد است." });
