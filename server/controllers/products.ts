import type { Request, Response } from "express";
import { getProductFromDatabase, listProductsFromDatabase } from "../repositories/products";

export async function listProducts(req: Request, res: Response) {
  const products = await listProductsFromDatabase({
    activeOnly: true,
    query: String(req.query.q ?? "").trim(),
    category: String(req.query.category ?? "").trim(),
  });
  res.removeHeader("ETag");
  res.set("Cache-Control", "no-store");
  res.status(200).json({ products });
}

export async function getProduct(req: Request, res: Response) {
  const product = await getProductFromDatabase(Number(req.params.id));
  if (!product || !product.active) return res.status(404).json({ message: "محصول پیدا نشد." });
  res.removeHeader("ETag");
  res.set("Cache-Control", "no-store");
  res.status(200).json({ product });
}
