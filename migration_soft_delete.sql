-- WeRecord 数据库软删除升级脚本
-- 请将以下 SQL 复制并粘贴到 Supabase SQL Editor 中运行：

-- 1. 为 core 核心表添加 deleted_at 字段
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.gifts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.aa_bills ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. 对已删除的数据我们甚至可以为其建立索引，加快过滤未删除数据的查询性能
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON public.events(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gifts_deleted_at ON public.gifts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aa_bills_deleted_at ON public.aa_bills(deleted_at) WHERE deleted_at IS NULL;
