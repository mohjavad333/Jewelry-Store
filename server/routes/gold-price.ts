import { Router } from "express";
import { handleGoldPrice } from "../controllers/gold-price";

export const goldPriceRouter = Router();

goldPriceRouter.get("/", handleGoldPrice);
