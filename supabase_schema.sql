-- WeRecord 情侣账本 数据库建表 SQL (Supabase Auth 增强版)

-- 1. 情侣组表
CREATE TABLE IF NOT EXISTS couples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT DEFAULT 'Our Home',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 个人资料表 (关联 Auth.Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_id UUID REFERENCES couples(id) ON DELETE SET NULL,
  identity TEXT NOT NULL DEFAULT 'me' CHECK (identity IN ('me', 'her')),
  display_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  alipay_code TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 分类表
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#e8956d',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(couple_id, name)
);

-- 3.5. 场景/事件表 (Event Ledger)
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(couple_id, title)
);

-- 4. 礼物记录表
CREATE TABLE IF NOT EXISTS gifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES auth.users(id),
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

-- 5. AA账单表
CREATE TABLE IF NOT EXISTS aa_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES auth.users(id),
  payer TEXT NOT NULL CHECK (payer IN ('me', 'her')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  total_amount DECIMAL(10, 2) NOT NULL,
  my_share DECIMAL(10, 2) NOT NULL,
  bill_type TEXT NOT NULL DEFAULT 'aa' CHECK (bill_type IN ('aa', 'borrow')),
  source_text TEXT DEFAULT '',
  note TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  image_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AA账单商品明细表
CREATE TABLE IF NOT EXISTS aa_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES aa_bills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT
);

-- 7. 辅助函数 (SECURITY DEFINER 以避免 RLS 递归)
CREATE OR REPLACE FUNCTION get_my_couple_id() 
RETURNS UUID AS $$
  SELECT couple_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 8. 开启 RLS
ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aa_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE aa_items ENABLE ROW LEVEL SECURITY;

-- 9. RLS 策略

-- Couples: 只能查看自己所在的组
CREATE POLICY "view_my_couple" ON couples FOR SELECT USING (id = get_my_couple_id());

-- Profiles: 只能修改自己，查看组内成员
CREATE POLICY "manage_own_profile" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "view_group_profiles" ON profiles FOR SELECT USING (couple_id = get_my_couple_id());

-- Categories: 全局默认或组内可见
CREATE POLICY "view_categories" ON categories FOR SELECT USING (couple_id IS NULL OR couple_id = get_my_couple_id());
CREATE POLICY "manage_group_categories" ON categories FOR ALL USING (couple_id = get_my_couple_id());

-- Events: 组内可见，组内管理
CREATE POLICY "manage_group_events" ON events FOR ALL USING (couple_id = get_my_couple_id());

-- Gifts: 组内操作
CREATE POLICY "manage_group_gifts" ON gifts FOR ALL USING (couple_id = get_my_couple_id());

-- AA Bills: 组内操作
CREATE POLICY "manage_group_bills" ON aa_bills FOR ALL USING (couple_id = get_my_couple_id());

-- AA Items: 通过对应的 Bill 间接控制 (这里简化为组内)
CREATE POLICY "manage_group_aa_items" ON aa_items FOR ALL USING (
  EXISTS (SELECT 1 FROM aa_bills WHERE id = aa_items.bill_id AND couple_id = get_my_couple_id())
);
-- 10. 邀请码表 (2.0 账号绑定核心)
CREATE TABLE IF NOT EXISTS invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- 6位大写字母数字
  inviter_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage_own_invitations" ON invitations FOR ALL USING (inviter_id = auth.uid());

-- 11. 推送订阅表 (迁移更新)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_identity TEXT NOT NULL,
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_identity, couple_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage_own_push" ON push_subscriptions FOR ALL USING (
  couple_id = get_my_couple_id()
);

-- 12. AA草稿表 (架构升级新增)
CREATE TABLE IF NOT EXISTS aa_drafts (
  id TEXT PRIMARY KEY,
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES auth.users(id),
  record_type TEXT NOT NULL CHECK (record_type IN ('gift', 'aa', 'borrow')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE aa_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage_group_drafts" ON aa_drafts FOR ALL USING (couple_id = get_my_couple_id());

-- 13. Storage Bucket: event_covers (新增存储桶)
INSERT INTO storage.buckets (id, name, public) VALUES ('event_covers', 'event_covers', true) ON CONFLICT DO NOTHING;

CREATE POLICY "public_view_event_covers" ON storage.objects FOR SELECT USING (bucket_id = 'event_covers');
CREATE POLICY "auth_upload_event_covers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event_covers');
CREATE POLICY "auth_update_event_covers" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'event_covers');
CREATE POLICY "auth_delete_event_covers" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'event_covers');
