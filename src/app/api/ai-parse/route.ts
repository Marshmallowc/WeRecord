import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

const SYSTEM_PROMPT = `你是一个专业、严谨的情侣支出与礼物管理助手。请根据用户输入识别出所有的消费或礼物记录，并返回一个结果数组。

重要规则：
1. 返回格式：必须是一个 JSON 数组，例如：[{"type": "gift", ...}, {"type": "aa", ...}]。
2. 严禁 Emoji：返回的文字内容中禁止包含任何 Emoji 表情。
3. 数字解析：鲁棒地处理金额，例如 "19。9" 应解析为 19.9。

结果项定义：

礼物 (gift)：
{
  "type": "gift",
  "from": "me | her",
  "to": "me | her",
  "title": "礼物名称（去 Emoji）",
  "category": "分类名",
  "amount": 数字或 null,
  "description": "备注说明（去 Emoji）",
  "date": "YYYY-MM-DD"
}

AA 账单 (aa)：
{
  "type": "aa",
  "payer": "me | her",
  "items": [{ "name": "商品名（去 Emoji）", "amount": 数字, "category": "分类名" }],
  "total": 合计数字,
  "my_share": 数字, // 重要：这是指归属于“我”的那部分金额
  "note": "备注（去 Emoji）",
  "date": "YYYY-MM-DD"
}

判定逻辑与身份映射：
1. "当前身份" 指的是输入这段话的用户。
2. 在结果中：
   - 如果当前身份是 "我"，则 "我" 映射为 'me'，"她/对方" 映射为 'her'。
   - 如果当前身份是 "她"，则 "我" 映射为 'her'，"他/对方" 映射为 'me'。
3. 债务（AA）分摊逻辑：
   - 默认 AA：如果没有特别说明，默认双方平摊，my_share 为总金额的一半。
   - 借款/代付全部：
     - 如果是“我借给对方X元”或“我帮对方付了全部X元”，则 payer 为 [当前身份], my_share 为 0 (表示全部由对方欠债)。
     - 如果是“对方借给我X元”或“对方帮我付了全部X元”，则 payer 为 [对方], my_share 为 X (表示全部由我欠债)。
4. 语义解析示例：
   - "我请..."、"我买了礼物送给..." -> type: "gift", from: [当前身份], to: [对方]。
   - "她请我..." -> type: "gift", from: [对方], to: [当前身份]。
   - "我付了..." -> type: "aa", payer: [当前身份] (默认平摊)。
   - "我借给对方50元" -> type: "aa", payer: [当前身份], total: 50, my_share: 0。
5. 如果未指明支付人或送礼人，默认 payer/from 为 [当前身份]。`

export async function POST(req: NextRequest) {
  const { text, identity } = await req.json()

  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }

  try {
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
          {
            role: 'user',
            content: `今天日期：${new Date().toISOString().split('T')[0]}\n当前身份：${identity === 'me' ? '我' : '她'}\n\n用户输入：${text}`
          },
        ],
        temperature: 0.1,
        max_tokens: 600,
        stream: false,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('DeepSeek error:', err)
      return NextResponse.json({ error: 'AI service error' }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 500 })
    }

    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json({ result: parsed, source_text: text })
  } catch (err) {
    console.error('Parse error:', err)
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }
}
