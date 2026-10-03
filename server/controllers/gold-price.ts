import type { RequestHandler } from "express";
import { getGoldPriceSnapshot } from "../services/gold-price";

export const handleGoldPrice: RequestHandler = async (_req, res) => {
  res.json(await getGoldPriceSnapshot());
};
