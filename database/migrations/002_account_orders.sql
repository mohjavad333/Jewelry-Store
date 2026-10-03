CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  receiver TEXT NOT NULL,
  phone TEXT NOT NULL,
  details TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('login', 'register')),
  name TEXT,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  tracking TEXT NOT NULL UNIQUE,
  note TEXT,
  address JSONB NOT NULL,
  totals JSONB NOT NULL,
  payment_method TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  weight NUMERIC(10, 3) NOT NULL CHECK (weight > 0),
  price BIGINT NOT NULL CHECK (price >= 0),
  image TEXT NOT NULL,
  customization TEXT
);

CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON addresses (user_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS auth_challenges_expires_at_idx ON auth_challenges (expires_at);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_date_idx ON orders (date DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
