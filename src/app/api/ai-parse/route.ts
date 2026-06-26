import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

const SYSTEM_PROMPT = `你是一个专业、严谨的情侣支出与礼物管理助手。请根据用户输入识别出所有的消费或礼物记录，并返回一个 JSON 对象，结构为 {"records": [...] }。

重要规则：
1. 返回格式：必须是一个 JSON 对象，且顶级键为 "records"，值为账单/礼物项数组，例如：
   {
     "records": [
       {
         "type": "aa",
         "reasoning": "...",
         ...
       }
     ]
   }
2. 严禁 Emoji：返回的文字内容中禁止包含任何 Emoji 表情。
3. 数字解析：鲁棒地处理金额，例如 "19。9" 应解析为 19.9。

思维链推理 (CoT - 极度重要)：
在生成每个账单/礼物时，必须首先生成 reasoning 字段，解释你的算账和分摊过程，然后再输出后面的字段。特别针对复杂垫付和请客逻辑，先推理再计算！

结果项定义：

礼物 (gift)：
{
  "type": "gift",
  "reasoning": "思维链推理过程，写出谁送谁礼物，金额是多少",
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
  "reasoning": "思维链推理过程，解释谁付款的、怎么分摊，算账逻辑是什么，逻辑上是如何计算得出 my_share 的值",
  "payer": "me | her",
  "title": "简短的标题（如：超市买菜、食堂面食），可以适当加点趣味性，幽默感",
  "items": [{ "name": "商品名（去 Emoji）", "amount": 数字, "category": "分类名" }],
  "total": 合计数字,
  "my_share": 数字, // 重要：这是指归属于“我”的那部分金额
  "note": "备注（去 Emoji）",
  "date": "YYYY-MM-DD"
}

判定逻辑与身份映射：
1. "当前身份" 指的是输入这段话的用户。
2. 在返回的 JSON 中，必须遵循以下身份映射约定（非常重要）：
   - 使用 'me' 指代“当前身份”（即正在说话的用户）。
   - 使用 'her' 指代“对方/伙伴”。
3. 即使当前身份是“她”，在 JSON 中也要用 'me' 来指代她自己，用 'her' 指代对方。
4. 代词与错别字容错（极其重要）：不论用户输入中出现的是“他”、“她”还是“Ta”，在判定身份时一律代指“对方/伙伴”（即 'her'），绝对不能根据代词的性别特征去强行和男女用户对齐。因为手机输入法中极易打错拼音。只有当明确说“我”、“我自己”时才指代当前说话人（即 'me'）。例如：“帮他买饭”是指“我帮对方买饭”（payer: 'me', my_share: 0）。
5. 债务（AA）分摊与请客垫付逻辑 (非常重要)：
   - 默认平摊：如果没有特别说明，默认双方平摊，my_share 为总金额的一半（即说话人自己应负担的金额）。
   - 请客/垫付/代付：
     - 如果是“他/她请我，但我先付的款”，说明：由对方请我，所以最终我应分摊的 my_share 应该为 0。但因为是我先垫付付了款，payer 是 'me'，总金额是两人的总价，我实际应负担的 my_share 是 0，对方应承担剩余全部。这表示对方欠我总价。
     - 如果是“我请客，但他/她先付的款”，说明：由我请客，所以最终我应分摊的 my_share 应该为总金额（全包）。因为是对方付款的（payer: 'her'），总金额是两人的总价，我应分摊 my_share 应该是总价。
     - 如果是“我借给对方X元”、“我帮对方付了全部X元”、“帮他/她买东西 X元”等我垫付或代付场景，则 payer 为 'me', my_share 为 0 (表示说话人自己应负担 0，金额全由对方负责)。
     - 如果是“对方借给我X元”、“对方帮我付了全部X元”、“他/她帮我买饭/买东西 X元”等，则 payer 为 'her', my_share 为 X (表示说话人自己应负担 X)。
6. 语义解析示例：
   - "我请..."、"我买了礼物送给..." -> type: "gift", from: 'me', to: 'her'。
   - "她请我..." -> type: "gift", from: 'her', to: 'me'。
   - "我付了..." -> type: "aa", payer: 'me' (默认平摊)。
7. 如果未指明支付人或送礼人，默认 payer/from 为 'me'。`

const GiftSchema = z.object({
  type: z.literal('gift'),
  reasoning: z.string(),
  from: z.enum(['me', 'her']),
  to: z.enum(['me', 'her']),
  title: z.string(),
  category: z.string().nullable().optional(),
  amount: z.number().nullable(),
  description: z.string().nullable().optional(),
  date: z.string()
})

const AAItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
  category: z.string()
})

const AASchema = z.object({
  type: z.literal('aa'),
  reasoning: z.string(),
  payer: z.enum(['me', 'her']),
  title: z.string(),
  items: z.array(AAItemSchema),
  total: z.number(),
  my_share: z.number(),
  note: z.string().nullable().optional(),
  date: z.string()
})

const AIResponseSchema = z.object({
  records: z.array(z.union([GiftSchema, AASchema]))
})

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
        max_tokens: 1500,
        response_format: { type: 'json_object' },
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

    const validated = AIResponseSchema.safeParse(parsed)
    if (!validated.success) {
      console.error('Zod Validation failed for AI response:', validated.error)
      return NextResponse.json({
        error: 'AI response structure validation failed',
        details: validated.error.issues,
        raw_response: parsed
      }, { status: 422 })
    }

    return NextResponse.json({ result: validated.data.records, source_text: text })
  } catch (err: any) {
    console.error('Parse error:', err)
    return NextResponse.json({ error: 'Failed to parse AI response: ' + err.message }, { status: 500 })
  }
}
