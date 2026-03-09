import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

export async function POST(req: NextRequest) {
  try {
    const { stats, identity, partnerName } = await req.json()

    // Construct a concise summary for the AI
    const summary = `
      Current User: ${identity}
      Partner: ${partnerName}
      Stats Summary:
      - Total Gifts Sent by Me: ${stats.gifts.totalByMe}
      - Total Gifts Sent by Partner: ${stats.gifts.totalByHer}
      - Top AA Categories: ${Object.entries(stats.aa.categories).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(', ')}
      - Workday vs Weekend Ratio: ${stats.analytics.timeDistribution.workday}:${stats.analytics.timeDistribution.weekend}
    `

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是一个暖心的情侣生活观察员。基于用户提供的消费统计摘要，给出1-2句温情、幽默且富有生活气息的评价或建议。
            规则：
            1. 语气：像老朋友一样聊天，不要官方。
            2. 语言：中文。
            3. 禁止 Emoji。
            4. 视角：${identity === 'me' ? '对我说，提到对方为' + partnerName : '对我说，提到对方为伙伴'}。
            5. 长度：50字以内。`
          },
          {
            role: 'user',
            content: summary
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    })

    const data = await response.json()
    const insight = data.choices[0].message.content

    return NextResponse.json({ insight })
  } catch (error) {
    console.error('AI Insights Error:', error)
    return NextResponse.json({ insight: "生活就是细节的堆叠，一起记录，一起成长。" })
  }
}
