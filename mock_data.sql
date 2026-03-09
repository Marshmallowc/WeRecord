-- WeRecord Mock 数据生成脚本 (V7 强化版)
-- 生成过去 6 个月内、高密度的测试数据，用于测试趋势图与热力图

-- 1. 清理旧数据
DELETE FROM aa_items;
DELETE FROM aa_bills;
DELETE FROM gifts;

-- 2. 生成 Mock 礼物 (Gifts) - 过去 180 天分布
INSERT INTO gifts (from_user, to_user, title, amount, category, date, created_at)
SELECT 
  (ARRAY['me', 'her'])[floor(random() * 2 + 1)] as from_user,
  'her' as to_user,
  (ARRAY['乐高积木', '护肤套装', '下午茶', '联名盲盒', '惊喜花束', '游戏手柄', '音乐会门票', '香水'])[floor(random() * 8 + 1)] as title,
  (random() * 600 + 30)::decimal(10,2) as amount,
  (ARRAY['礼物', '社交', '娱乐', '惊喜'])[floor(random() * 4 + 1)] as category,
  (CURRENT_DATE - (n || ' days')::interval)::date as date,
  (CURRENT_DATE - (n || ' days')::interval + (random() * 24 || ' hours')::interval) as created_at
FROM generate_series(1, 180, 5) n; -- 每 5 天一条礼物

-- 3. 生成 Mock AA 账单 (AA Bills) - 过去 180 天分布
WITH inserted_bills AS (
  INSERT INTO aa_bills (payer, status, total_amount, my_share, note, date, created_at)
  SELECT 
    (ARRAY['me', 'her'])[floor(random() * 2 + 1)] as payer,
    (ARRAY['pending', 'settled'])[floor(random() * 2 + 1)] as status,
    0, 0, -- 占位
    (ARRAY['日常吃饭', '超市采购', '电影票', '打车支出', '水电缴费', '奶茶水果', '周末大餐', '猫粮猫砂'])[floor(random() * 8 + 1)] as note,
    (CURRENT_DATE - (n || ' days')::interval)::date as date,
    (CURRENT_DATE - (n || ' days')::interval + (random() * 24 || ' hours')::interval) as created_at
  FROM generate_series(1, 180, 1) n -- 每天都有账单
  RETURNING id
)
-- 4. 为每个账单生成 1-3 条商品明细 (AA Items)
INSERT INTO aa_items (bill_id, name, amount, category)
SELECT 
  id,
  (ARRAY['晚餐', '打车', '电影', '咖啡', '生活用品', '零食'])[floor(random() * 6 + 1)],
  (random() * 150 + 10)::decimal(10,2),
  (ARRAY['餐饮', '交通', '娱乐', '日常', '购物'])[floor(random() * 5 + 1)]
FROM inserted_bills, generate_series(1, floor(random() * 3 + 1)::int);

-- 5. 自动回填账单总额与各自份额
UPDATE aa_bills b
SET 
  total_amount = (SELECT SUM(amount) FROM aa_items WHERE bill_id = b.id),
  my_share = (SELECT SUM(amount) FROM aa_items WHERE bill_id = b.id) / 2;

-- 6. 确保 profiles 表有数据
INSERT INTO profiles (id, display_name, avatar_url) 
VALUES 
  ('me', '我的名字', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'),
  ('her', 'Ta的名字', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka')
ON CONFLICT (id) DO NOTHING;
