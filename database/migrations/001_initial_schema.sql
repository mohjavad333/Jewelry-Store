CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  identifier TEXT NOT NULL UNIQUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  weight NUMERIC(10, 3) NOT NULL CHECK (weight > 0),
  karat NUMERIC(4, 1) NOT NULL CHECK (karat > 0 AND karat <= 24),
  price BIGINT NOT NULL CHECK (price >= 0),
  image TEXT NOT NULL,
  description TEXT NOT NULL,
  tag TEXT,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_active_idx ON products (active);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
CREATE INDEX IF NOT EXISTS users_identifier_idx ON users (identifier);

INSERT INTO products (id, name, category, weight, karat, price, image, description, tag, stock, active)
VALUES
  (1, 'گردنبند ونوس', 'گردنبند', 3.42, 18, 29840000, 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=90', 'زنجیری ظریف و چشم‌نواز با طراحی الهام‌گرفته از نور و حرکت؛ انتخابی ماندگار برای استفاده روزمره و مهمانی.', 'پرفروش', 8, TRUE),
  (2, 'انگشتر مینیمال آتنا', 'انگشتر', 1.86, 18, 16290000, 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=90', 'فرمی مینیمال با پرداخت آینه‌ای و خطوطی نرم که به‌سادگی با استایل روزانه شما هماهنگ می‌شود.', 'جدید', 5, TRUE),
  (3, 'گوشواره هاله', 'گوشواره', 2.15, 18, 20450000, 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1200&q=90', 'گوشواره‌ای سبک با درخشش لطیف که برای ساختن یک استایل ظریف و متفاوت طراحی شده است.', NULL, 12, TRUE),
  (4, 'دستبند زنجیری نور', 'دستبند', 4.8, 18, 41780000, 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1200&q=90', 'دستبندی با بافت زنجیری کلاسیک و قفل ایمن؛ ترکیبی از ظرافت، دوام و درخشش همیشگی.', NULL, 3, TRUE)
ON CONFLICT (id) DO NOTHING;
