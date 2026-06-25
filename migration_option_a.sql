-- WeRecord 方案A 数据库迁移脚本
-- 目的：移除旧的全局唯一约束，改为仅限制“未删除（活跃）”的场景不能同名，允许新创建同名场景与回收站中的场景共存。
-- 运行说明：请复制此脚本到 Supabase SQL Editor 中直接运行。

-- 1. 移除旧的全局唯一约束 (events_couple_id_title_key)
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_couple_id_title_key;

-- 2. 创建部分唯一索引 (uq_active_event_title)
-- 只有在 deleted_at 为 NULL（活跃场景）时才限制 couple_id 和 title 的唯一性
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_event_title 
ON public.events(couple_id, title) 
WHERE deleted_at IS NULL;
