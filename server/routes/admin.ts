import { Router, type RequestHandler } from "express";
import { adminAccessOverview, adminCreateProduct, adminCreateUser, adminCustomerOrders, adminDeleteProduct, adminDeleteUser, adminListActivity, adminLogin, adminLogout, adminOverview, adminUpdateOrderStatus, adminUpdateProduct, adminUpdateStock, adminUpdateUser } from "../controllers/admin";

export function createAdminRouter(loginMiddleware: RequestHandler[] = []) {
  const router = Router();
  router.post("/login", ...loginMiddleware, adminLogin);
  router.post("/logout", adminLogout);
  router.get("/overview", adminOverview);
  router.get("/customers/:id/orders", adminCustomerOrders);
  router.get("/access", adminAccessOverview);
  router.get("/activity", adminListActivity);
  router.post("/users", adminCreateUser);
  router.patch("/users/:id", adminUpdateUser);
  router.delete("/users/:id", adminDeleteUser);
  router.patch("/orders/:id/status", adminUpdateOrderStatus);
  router.patch("/products/:id/stock", adminUpdateStock);
  router.post("/products", adminCreateProduct);
  router.patch("/products/:id", adminUpdateProduct);
  router.delete("/products/:id", adminDeleteProduct);
  return router;
}
