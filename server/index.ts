import "dotenv/config";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { createAccountRouter, createAuthRouter, demoAuthRouter } from "./routes/auth";
import { createAdminRouter } from "./routes/admin";
import { goldPriceRouter } from "./routes/gold-price";
import { ordersRouter } from "./routes/orders";
import { productsRouter } from "./routes/products";
import { adminLoginByIdentifier, adminLoginByIp, otpRequestByIdentifier, otpRequestByIp, otpVerifyByChallenge, otpVerifyByIp } from "./middlewares/rate-limit";
import { requireTrustedOrigin } from "./middlewares/security";
import { db } from "./db";
import { isProductionLikeEnvironment } from "./env";
import { requestErrorHandler, requestObservability } from "./middlewares/observability";

export function createServer() {
  const app = express();
  const isProductionLike = isProductionLikeEnvironment();
  const configuredOrigin = process.env.CLIENT_ORIGIN;
  const otpRequestLimits = isProductionLike ? [otpRequestByIp, otpRequestByIdentifier] : [];
  const otpVerifyLimits = isProductionLike ? [otpVerifyByIp, otpVerifyByChallenge] : [];
  const adminLoginLimits = isProductionLike ? [adminLoginByIp, adminLoginByIdentifier] : [];

  app.disable("x-powered-by");
  app.use(requestObservability);
  if (isProductionLike) app.set("trust proxy", 1);
  app.use(cors({ origin: configuredOrigin ?? (isProductionLike ? false : true), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(requireTrustedOrigin);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    if (isProductionLike) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self'; connect-src 'self'");
    }
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "zarinsa",
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/health/ready", async (_req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "ready" });
    } catch (error) {
      console.error("Readiness check failed.", error);
      res.status(503).json({ status: "not_ready" });
    }
  });

  app.use("/api/gold-price", goldPriceRouter);
  if (!isProductionLike) app.use("/api/auth", demoAuthRouter);
  app.use("/api/auth", createAuthRouter({ requestCodeMiddleware: otpRequestLimits, verifyCodeMiddleware: otpVerifyLimits }));
  app.use("/api/account", createAccountRouter());
  app.use("/api", ordersRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/admin", createAdminRouter(adminLoginLimits));
  app.use(requestErrorHandler);

  return app;
}
