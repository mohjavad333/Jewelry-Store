import type { NextFunction, Request, Response } from "express";

const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  if (!stateChangingMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const configuredOrigin = process.env.CLIENT_ORIGIN;
  if (!origin || !configuredOrigin || origin === configuredOrigin) {
    next();
    return;
  }

  res.status(403).json({ message: "مبدأ درخواست معتبر نیست." });
}
