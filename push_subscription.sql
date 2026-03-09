-- push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_identity TEXT NOT NULL, -- 'me' or 'her'
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by identity
CREATE INDEX IF NOT EXISTS idx_push_identity ON public.push_subscriptions(user_identity);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Simple policies for now (Allow all anon access for PWA convenience)
CREATE POLICY "Allow all push" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);
