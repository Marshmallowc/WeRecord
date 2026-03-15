-- AI 投资/理财见解表
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  insight_type TEXT DEFAULT 'wisdom' CHECK (insight_type IN ('wisdom', 'analysis', 'nudge')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 开启 RLS
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- 策略：组内成员可见
CREATE POLICY "manage_group_insights" ON ai_insights FOR ALL USING (
  couple_id = (SELECT couple_id FROM profiles WHERE id = auth.uid())
);
