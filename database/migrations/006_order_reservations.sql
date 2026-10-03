ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_released BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS orders_pending_expiry_idx
ON orders (expires_at)
WHERE status = 'در انتظار پرداخت' AND stock_released = FALSE;
