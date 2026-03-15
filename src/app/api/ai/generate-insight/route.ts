import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

const SYSTEM_PROMPT = `你叫 Mason，是一个睿智、理性且充满温度、幽默风趣的情侣理财导师。
你的任务是根据一对大学生情侣最近的消费和送礼记录，提供深度、高质量的理财见解或生活哲学。

要求：
1. 身份设定：你不仅是一个分析师，更是一个关心他们生活质量的朋友。
2. 见解深度：不要只是列出事实。要结合“高维度”的人（如成功的投资者之类的）的视角，谈谈如何管理资金、如何通过消费获得真正的幸福。
3. 目的：帮助他们建立金钱观点，理财观，他们即将步入社会，一定会面临如何攒钱，如何投资，如何消费，如何处理金钱和感情的关系等等问题。
4. 建议：如果最近有一些相关方面的新闻，可以结合新闻内容给出建议。当然没有也不要强制给。
5. 语气：亲切、专业、无 Emoji（这是本项目严格要求的）。
6. 长度：控制在 150-300 字之间，不要加文章标题。

返回格式：直接返回文本，不要包含任何 JSON 标签或代码块。`

// 使用 Service Role Key 绕过 RLS (仅服务器端使用)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function generateForCouple(coupleId: string) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const dateStr = sevenDaysAgo.toISOString().split('T')[0]

  const [giftsRes, billsRes, insightsRes] = await Promise.all([
    supabaseAdmin.from('gifts').select('*').eq('couple_id', coupleId).gte('date', dateStr),
    supabaseAdmin.from('aa_bills').select('*, aa_items(*)').eq('couple_id', coupleId).gte('date', dateStr),
    supabaseAdmin.from('ai_insights').select('content, date').eq('couple_id', coupleId).order('created_at', { ascending: false }).limit(5)
  ])

  const context = `
最近 7 天的记录：
礼物：${JSON.stringify(giftsRes.data || [])}
支出：${JSON.stringify(billsRes.data || [])}

你之前给出的建议（请避免重复类似的观点，尝试从不同角度启发他们）：
${insightsRes.data?.map(i => `- [${i.date}]: ${i.content.slice(0, 100)}...`).join('\n') || '无'}
`

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: context },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) throw new Error('AI Service Error')
  const aiData = await response.json()
  const content = aiData.choices?.[0]?.message?.content

  if (!content) throw new Error('Empty content from AI')

  return supabaseAdmin.from('ai_insights').insert({
    couple_id: coupleId,
    content,
    insight_type: 'wisdom',
    date: new Date().toISOString().split('T')[0]
  })
}

export async function POST(req: NextRequest) {
  // 验证 Cron Secret
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. 获取所有有成员的情侣组 (过滤掉没有任何成员关联的空组)
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('couple_id')
      .not('couple_id', 'is', null)

    if (fetchError) throw fetchError

    // 去重，提取唯一的 couple_id
    const activeCoupleIds = Array.from(new Set(profiles.map(p => p.couple_id))) as string[]

    console.log(`Starting AI insight generation for ${activeCoupleIds.length} couples...`)

    const results = await Promise.allSettled(
      activeCoupleIds.map(id => generateForCouple(id))
    )

    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failCount = results.length - successCount

    return NextResponse.json({ 
      success: true, 
      processed: activeCoupleIds.length, 
      successCount, 
      failCount 
    })
  } catch (err: any) {
    console.error('Cron job error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
