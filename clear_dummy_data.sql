-- WeRecord 数据清理与重置实用 SQL 脚本
-- 你可以直接复制下面的 SQL 语句，在 Supabase SQL Editor 中运行。

-- ==========================================
-- 选项 A：仅删除最近 X 小时内插入的测试账单/礼物 (推荐)
-- ==========================================
-- 这样做不会破坏你以前的真实历史数据，只清除你刚刚真机测试或 AI 生成的垃圾数据。
-- 这里以清除过去 24 小时内创建的记录为例，你可以修改 INTERVAL '1 day' 为你需要的范围。

-- 1. 删除过去 24 小时内的礼物
DELETE FROM public.gifts 
WHERE created_at > NOW() - INTERVAL '1 day';

-- 2. 删除过去 24 小时内的 AA 账单 (级联自动删除 aa_items 商品明细)
DELETE FROM public.aa_bills 
WHERE created_at > NOW() - INTERVAL '1 day';

-- 3. 删除过去 24 小时内创建的场景/事件
DELETE FROM public.events 
WHERE created_at > NOW() - INTERVAL '1 day';


-- ==========================================
-- 选项 B：完全清空所有账单与场景数据 (彻底重置)
-- ==========================================
-- 如果你想彻底推翻重来，让账本完全回到空空如也的干净状态，请运行以下命令：

/* 
-- 1. 清空所有账单 (级联删除 aa_items)
TRUNCATE TABLE public.aa_bills RESTART IDENTITY CASCADE;

-- 2. 清空所有礼物
TRUNCATE TABLE public.gifts RESTART IDENTITY CASCADE;

-- 3. 清空所有场景
TRUNCATE TABLE public.events RESTART IDENTITY CASCADE;
*/
