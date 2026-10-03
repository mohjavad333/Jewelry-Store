import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";

export const requestObservability: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    if (req.path.startsWith("/health")) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(JSON.stringify({
      event: "http_request",
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    }));
  });

  next();
};

export const requestErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = String(res.getHeader("X-Request-Id") ?? "unknown");
  console.error(JSON.stringify({
    event: "http_request_error",
    requestId,
    method: req.method,
    path: req.path,
    error: error instanceof Error ? error.name : "UnknownError",
  }));

  if (res.headersSent) return;
  res.status(500).json({ message: "خطای داخلی سرور رخ داد.", requestId });
};
