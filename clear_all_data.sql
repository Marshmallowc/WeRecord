-- WeRecord 数据库数据清理脚本 (用于上线前清空测试数据)
-- 请在 Supabase SQL Editor 中执行

-- 1. 禁用外键检查（部分环境可能需要，但在 PostgreSQL 中通常使用 TRUNCATE CASCADE）
-- TRUNCATE 是最快且最干净的方式，它还会重置自增 ID (SERIAL)

-- 清空 AA 相关的记录（CASCADE 会自动清理 aa_items）
TRUNCATE TABLE public.aa_bills RESTART IDENTITY CASCADE;

-- 清空账单明细（虽然 CASCADE 已经处理，为了保险可以显式执行）
TRUNCATE TABLE public.aa_items RESTART IDENTITY CASCADE;

-- 清空礼物记录
TRUNCATE TABLE public.gifts RESTART IDENTITY CASCADE;

-- 清空分类表
TRUNCATE TABLE public.categories RESTART IDENTITY CASCADE;

-- 清空推送订阅信息 (可选，建议清空以防止测试期间的过期订阅干扰)
TRUNCATE TABLE public.push_subscriptions RESTART IDENTITY CASCADE;

-- 2. 处理个人资料 (Profiles)
-- 我们通常不清空 profiles 表，因为里面存了 'me' 和 'her' 的基础信息。
-- 这里的操作是：清空自定义的名称和头像，回归默认状态。
UPDATE public.profiles 
SET display_name = CASE WHEN id = 'me' THEN '我' ELSE '她' END, 
    avatar_url = '', 
    updated_at = NOW();

-- 3. 验证清理结果
SELECT 'AA Bills' as table_name, count(*) FROM aa_bills
UNION ALL
SELECT 'Gifts', count(*) FROM gifts
UNION ALL
SELECT 'Categories', count(*) FROM categories
UNION ALL
SELECT 'Push Subs', count(*) FROM push_subscriptions;
