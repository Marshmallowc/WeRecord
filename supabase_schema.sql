-- WeRecord 情侣账本 数据库建表 SQL
-- 在 Supabase SQL Editor 中执行以下语句（全量，可重复执行）

-- 1. 分类表
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#e8956d',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 礼物记录表
CREATE TABLE IF NOT EXISTS gifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user TEXT NOT NULL CHECK (from_user IN ('me', 'her')),
  to_user TEXT NOT NULL CHECK (to_user IN ('me', 'her')),
  title TEXT NOT NULL,
  amount DECIMAL(10, 2),
  description TEXT,
  category TEXT,
  source_text TEXT DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  image_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AA账单表
CREATE TABLE IF NOT EXISTS aa_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payer TEXT NOT NULL CHECK (payer IN ('me', 'her')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  total_amount DECIMAL(10, 2) NOT NULL,
  my_share DECIMAL(10, 2) NOT NULL,
  source_text TEXT DEFAULT '',
  note TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  image_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AA账单商品明细表
CREATE TABLE IF NOT EXISTS aa_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES aa_bills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT
);

-- 5. RLS 策略
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aa_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE aa_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_gifts" ON gifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_aa_bills" ON aa_bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_aa_items" ON aa_items FOR ALL USING (true) WITH CHECK (true);

-- 6. 已有数据库迁移（如果之前已建表，执行这些）
-- ALTER TABLE aa_items ADD COLUMN IF NOT EXISTS category TEXT;
-- ALTER TABLE gifts ADD COLUMN IF NOT EXISTS category TEXT;
-- ALTER TABLE gifts ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
-- ALTER TABLE aa_bills ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- 7. 索引
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_gifts_from_user ON gifts(from_user);
CREATE INDEX IF NOT EXISTS idx_gifts_date ON gifts(date DESC);
CREATE INDEX IF NOT EXISTS idx_aa_bills_status ON aa_bills(status);
CREATE INDEX IF NOT EXISTS idx_aa_bills_payer ON aa_bills(payer);
CREATE INDEX IF NOT EXISTS idx_aa_bills_date ON aa_bills(date DESC);
CREATE INDEX IF NOT EXISTS idx_aa_items_bill_id ON aa_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_aa_items_category ON aa_items(category);

-- 8. 个人资料表
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, -- 'me' 或 'her'
  display_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  alipay_code TEXT DEFAULT '', -- 支付宝收款链接
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 如果表已存在，执行：ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alipay_code TEXT DEFAULT '';

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- 初始化默认数据
INSERT INTO profiles (id, display_name) VALUES ('me', '我') ON CONFLICT (id) DO NOTHING;
INSERT INTO profiles (id, display_name) VALUES ('her', '她') ON CONFLICT (id) DO NOTHING;

-- 9. 存储桶策略 (需要在创建 record_images 存储桶后执行)
-- CREATE POLICY "Allow Public View" ON storage.objects FOR SELECT USING ( bucket_id = 'record_images' );
-- CREATE POLICY "Allow Public Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'record_images' );
