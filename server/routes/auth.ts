import { Router, type RequestHandler } from "express";
import { createAddress, deleteAddress, demoLogin, getCurrentUser, listAddresses, logout, requestAuthCode, updateAddress, updateProfile, verifyAuthCode } from "../controllers/auth";

type AuthRouterOptions = {
  requestCodeMiddleware?: RequestHandler[];
  verifyCodeMiddleware?: RequestHandler[];
};

export function createAuthRouter(options: AuthRouterOptions = {}) {
  const router = Router();
  router.post("/request-code", ...(options.requestCodeMiddleware ?? []), requestAuthCode);
  router.post("/verify-code", ...(options.verifyCodeMiddleware ?? []), verifyAuthCode);
  router.get("/me", getCurrentUser);
  router.post("/logout", logout);
  return router;
}

export function createAccountRouter() {
  const router = Router();
  router.patch("/profile", updateProfile);
  router.get("/addresses", listAddresses);
  router.post("/addresses", createAddress);
  router.patch("/addresses/:id", updateAddress);
  router.delete("/addresses/:id", deleteAddress);
  return router;
}

export const demoAuthRouter = Router();
demoAuthRouter.post("/demo-login", demoLogin);
