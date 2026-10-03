import type { Product } from "../../shared/products";
import { db } from "../db";

type ProductInput = Omit<Product, "id">;

type ProductRow = {
  id: number;
  name: string;
  category: string;
  weight: number | string;
  karat: number | string;
  price: number | string;
  image: string;
  description: string;
  tag: string | null;
  stock: number;
  active: boolean;
};

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    weight: Number(row.weight),
    karat: Number(row.karat),
    price: Number(row.price),
    image: row.image,
    description: row.description,
    ...(row.tag ? { tag: row.tag } : {}),
    stock: row.stock,
    active: row.active,
  };
}

const productColumns = "id, name, category, weight, karat, price, image, description, tag, stock, active";

export async function listProductsFromDatabase(options: { activeOnly?: boolean; query?: string; category?: string } = {}) {
  const values: string[] = [];
  const conditions: string[] = [];

  if (options.activeOnly) conditions.push("active = TRUE");
  if (options.query) {
    values.push(`%${options.query}%`);
    conditions.push(`(name ILIKE $${values.length} OR category ILIKE $${values.length})`);
  }
  if (options.category && options.category !== "همه محصولات") {
    values.push(options.category);
    conditions.push(`category = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.query<ProductRow>(`SELECT ${productColumns} FROM products ${where} ORDER BY id`, values);
  return result.rows.map(toProduct);
}

export async function getProductFromDatabase(id: number) {
  const result = await db.query<ProductRow>(`SELECT ${productColumns} FROM products WHERE id = $1`, [id]);
  return result.rows[0] ? toProduct(result.rows[0]) : null;
}

export async function createProductInDatabase(input: ProductInput) {
  const result = await db.query<ProductRow>(
    `INSERT INTO products (name, category, weight, karat, price, image, description, tag, stock, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${productColumns}`,
    [input.name, input.category, input.weight, input.karat, input.price, input.image, input.description, input.tag ?? null, input.stock, input.active],
  );
  return toProduct(result.rows[0]);
}

export async function updateProductInDatabase(id: number, changes: Partial<ProductInput>) {
  const entries = Object.entries(changes);
  if (!entries.length) return getProductFromDatabase(id);

  const columnMap: Record<string, string> = {
    name: "name",
    category: "category",
    weight: "weight",
    karat: "karat",
    price: "price",
    image: "image",
    description: "description",
    tag: "tag",
    stock: "stock",
    active: "active",
  };
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of entries) {
    const column = columnMap[key];
    if (!column) continue;
    values.push(value ?? null);
    assignments.push(`${column} = $${values.length}`);
  }
  if (!assignments.length) return getProductFromDatabase(id);

  values.push(id);
  const result = await db.query<ProductRow>(
    `UPDATE products SET ${assignments.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING ${productColumns}`,
    values,
  );
  return result.rows[0] ? toProduct(result.rows[0]) : null;
}

export async function setProductStockInDatabase(id: number, stock: number) {
  return updateProductInDatabase(id, { stock });
}

export async function deactivateProductInDatabase(id: number) {
  return updateProductInDatabase(id, { active: false });
}

export async function decrementProductStock(id: number, quantity: number) {
  const result = await db.query<ProductRow>(
    `UPDATE products
     SET stock = stock - $2, updated_at = NOW()
     WHERE id = $1 AND active = TRUE AND stock >= $2
     RETURNING ${productColumns}`,
    [id, quantity],
  );
  return result.rows[0] ? toProduct(result.rows[0]) : null;
}
