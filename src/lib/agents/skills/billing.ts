import { Skill, ToolDefinition } from '../registry'

const PARSER_SYSTEM_PROMPT = `你是一个专业、严谨的情侣支出与礼物管理助手。请根据用户输入识别出所有的消费或礼物记录，并返回一个结果数组。

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
  "title": "简短的标题（如：超市买菜、食堂面食），可以适当加点趣味性，幽幽感",
  "items": [{ "name": "商品名（去 Emoji）", "amount": 数字, "category": "分类名" }],
  "total": 合计数字,
  "my_share": 数字, // 重要：这是指归属于“我”的那部分金额
  "note": "备注（去 Emoji）",
  "status": "pending | settled", // 状态：'pending' (未结清，默认) 或 'settled' (已结清，如果用户提到“已经结清”、“付了”、“给过了”、“微信付了”等)
  "date": "YYYY-MM-DD"
}

判定逻辑与身份映射：
1. "当前身份" 指的是输入这段话的用户。
2. 在返回的 JSON 中，必须遵循以下身份映射约定（非常重要）：
   - 使用 'me' 指代“当前身份”（即正在说话的用户）。
   - 使用 'her' 指代“对方/伙伴”。
3. 即使当前身份是“她”，在 JSON 中也要用 'me' 来指代她自己，用 'her' 指代对方。
4. 代词与错别字容错（极其重要）：不论用户输入中出现的是“他”、“她”还是“Ta”，在判定身份时一律代指“对方/伙伴”（即 'her'），绝对不能根据代词的性别特征去强行和男女用户对齐。因为手机输入法中极易打错拼音。只有当明确说“我”、“我自己”时才指代当前说话人（即 'me'）。例如：“帮他买饭”是指“我帮对方买饭”（payer: 'me', my_share: 0）。
5. 债务（AA）分摊逻辑：
   - 默认 AA：如果没有特别说明，默认双方平摊，my_share 为总金额的一半（即说话人自己应负担的金额）。
   - 借款/代付/帮对方付全部：
     - 如果是“我借给对方X元”、“我帮对方付了全部X元”、“帮他/她买饭/买东西 X元”等我垫付或代付场景，则 payer 为 'me', my_share 为 0 (表示说话人自己应负担 0，金额全由对方负责)。
     - 如果是“对方借给我X元”、“对方帮我付了全部X元”、“他/她帮我买饭/买东西 X元”等，则 payer 为 'her', my_share 为 X (表示说话人自己应负担 X)。
6. 语义解析示例：
   - "我请..."、"我买了礼物送给..." -> type: "gift", from: 'me', to: 'her'。
   - "她请我..." -> type: "gift", from: 'her', to: 'me'。
   - "我付了..." -> type: "aa", payer: 'me' (默认平摊)。
7. 如果未指明支付人或送礼人，默认 payer/from 为 'me'。`

export const addRecordTool: ToolDefinition<{ text: string }> = {
  name: 'add_record',
  description: '生成一条记账草稿以供用户核对确认，并返回草稿卡片（is_draft: true）。该操作并没有直接存入数据库，请引导用户核对下方的草稿卡片信息并点击“确认记入账本”以完成正式入库。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '用户原始的自然语言账务记录语句。必须直接传入用户的原始原话（例如“今天东区帮他买饭21元”），严禁你自行修改、润色、重写或翻译，不要擅自添加任何额外字眼（如不要添加“AA分摊”等）。' }
    },
    required: ['text']
  },
  execute: async (context, args) => {
    const { userId, coupleId, identity } = context
    const imageUrls = context.image_urls || []

    try {
      // 1. Call DeepSeek to parse natural language text into JSON structure
      const parseRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: PARSER_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `今天日期：${new Date().toISOString().split('T')[0]}\n当前身份：${identity === 'me' ? '我' : '她'}\n\n用户输入：${args.text}`
            },
          ],
          temperature: 0.1,
          max_tokens: 600,
        }),
      })

      if (!parseRes.ok) {
        const errorText = await parseRes.text()
        throw new Error(`AI parser service error: ${errorText}`)
      }

      const aiData = await parseRes.json()
      const content = aiData.choices?.[0]?.message?.content
      if (!content) throw new Error('Parser returned empty response')

      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const items = JSON.parse(cleaned)
      const resultsList = Array.isArray(items) ? items : [items]

      const parsedDrafts: any[] = []

      // 2. Generate drafts details
      for (const record of resultsList) {
        const tempId = `draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        
        // Map speaker-centric values ('me' = speaker, 'her' = partner) to database static identities
        const resolveIdentity = (val: string) => {
          if (identity !== 'her') return val
          if (val === 'me') return 'her'
          if (val === 'her') return 'me'
          return val
        }

        if (record.type === 'gift') {
          const { from, to, title, amount, description, date, category } = record
          parsedDrafts.push({
            id: tempId,
            record_type: 'gift',
            is_draft: true,
            from_user: resolveIdentity(from || 'me'),
            to_user: resolveIdentity(to || 'her'),
            title: title || '礼物记录',
            amount: amount ?? null,
            description: description ?? null,
            category: category ?? null,
            source_text: args.text,
            image_urls: imageUrls,
            date: date ?? new Date().toISOString().split('T')[0],
          })
        } else if (record.type === 'aa') {
          const { payer, items: aaItems, total, my_share, note, date } = record
          const dbPayer = resolveIdentity(payer || 'me')
          // my_share in database is stored relative to identity 'me' (boy).
          // If the calling user is 'her' (girl), her parsed my_share responsibility needs to be converted for 'me'.
          const dbMyShare = identity === 'her' ? (total - (my_share || 0)) : (my_share || 0)

          parsedDrafts.push({
            id: tempId,
            record_type: 'aa',
            is_draft: true,
            payer: dbPayer,
            status: record.status || 'pending',
            total_amount: total,
            my_share: dbMyShare,
            source_text: args.text,
            image_urls: imageUrls,
            note: note ?? null,
            title: record.title || '支出记录',
            aa_items: aaItems?.map((item: any, idx: number) => ({
              id: `draft-item-${tempId}-${idx}`,
              name: item.name || '支出项',
              amount: item.amount ?? (aaItems.length === 1 ? (total || 0) : 0),
              category: item.category ?? null
            })) ?? [{ id: `draft-item-${tempId}-0`, name: '生活杂项', amount: total, category: null }]
          })
        }
      }

      return {
        success: true,
        count: parsedDrafts.length,
        records: parsedDrafts
      }
    } catch (err: any) {
      console.error('[Agent Tool: add_record] Error:', err)
      return { success: false, error: err.message }
    }
  }
}

export const settleBillsTool: ToolDefinition<{ bill_ids: string[] }> = {
  name: 'settle_bills',
  description: '把指定的多个 AA 账单在数据库中标记为已结清（settled）状态。',
  parameters: {
    type: 'object',
    properties: {
      bill_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '需要结清的账单 UUID 列表'
      }
    },
    required: ['bill_ids']
  },
  execute: async (context, args) => {
    const { supabase, coupleId } = context
    try {
      const { data, error } = await supabase
        .from('aa_bills')
        .update({ status: 'settled' })
        .in('id', args.bill_ids)
        .eq('couple_id', coupleId)
        .select('id, note, total_amount, my_share, payer')

      if (error) throw error

      return {
        success: true,
        count: data?.length || 0,
        settled_bills: data
      }
    } catch (err: any) {
      console.error('[Agent Tool: settle_bills] Error:', err)
      return { success: false, error: err.message }
    }
  }
}

export const BillingSkill: Skill = {
  name: 'BillingSkill',
  description: '日常账目和礼物的增删改查、结账等事务性技能',
  tools: [addRecordTool, settleBillsTool]
}
