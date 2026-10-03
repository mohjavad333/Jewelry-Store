import { Router } from "express";
import { cancelOrder, createOrder, getOrder, listNotifications, listOrders, markNotificationAsRead, trackOrder } from "../controllers/orders";

export const ordersRouter = Router();

ordersRouter.post("/orders", createOrder);
ordersRouter.get("/account/orders", listOrders);
ordersRouter.get("/account/orders/:id", getOrder);
ordersRouter.post("/account/orders/:id/cancel", cancelOrder);
ordersRouter.get("/account/notifications", listNotifications);
ordersRouter.patch("/account/notifications/:id/read", markNotificationAsRead);
ordersRouter.get("/orders/track/:tracking", trackOrder);
