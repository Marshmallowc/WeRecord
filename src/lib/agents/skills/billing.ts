import { z } from 'zod'
import { Skill, ToolDefinition } from '../registry'

const PARSER_SYSTEM_PROMPT = `你是一个专业、严谨的情侣支出与礼物管理助手。请根据用户输入提取账单和礼物记录。

### 核心规则 (Core Rules)
1. 返回格式：必须是一个严格的 JSON 对象。
2. 思维链 (CoT)：必须首先输出 \`_reasoning\` 字段，简要分析以下三个问题：a. 消费属于单人还是共同？ b. 谁付的钱？ c. 按照常理说话人该承担多少？分析完毕后，再输出 \`records\` 数组。
3. 身份映射：
   - 'me' 指代“当前说话人”（即发送这段文字的用户）。
   - 'her' 指代“对方/伴侣”。
   - 即使当前说话人是女生，在 JSON 中也要用 'me' 指代她自己，用 'her' 指代男生。
4. 去除表情：所有文字内容禁止包含 Emoji。
5. 金额处理：未明确指出单价的物品，金额可设为 null。

### 字段定义 (Schema)
礼物 (gift)：
{"type": "gift", "from": "me | her", "to": "me | her", "title": "礼物名", "category": "分类名", "amount": 数字, "description": "备注", "date": "YYYY-MM-DD"}

AA账单 (aa)：
{"type": "aa", "payer": "me | her", "title": "标题", "items": [{"name": "商品", "amount": 数字, "category": "分类"}], "total": 合计总额, "my_share": 说话人应承担的金额, "note": "备注", "status": "pending | settled", "date": "YYYY-MM-DD"}

### 范例参考 (Few-Shot Examples)

【范例 1：共同消费，对方付款（平摊）】
输入："昨晚我们去麦德龙买了44块钱吃的，他给的"
输出：
{
  "_reasoning": "上下文中出现了‘我们’，属于共同消费，总金额 44。‘他给的’表示对方付了全款。既然是共同消费且未特指一方请客，默认两人平摊，因此说话人（me）应承担一半，即 22。",
  "records": [{"type": "aa", "payer": "her", "title": "麦德龙购物", "total": 44, "my_share": 22, "items": [{"name": "吃的", "amount": 44, "category": "餐饮"}]}]
}

【范例 2：共同消费，自己付款（平摊）】
输入："今天吃火锅200我付的"
输出：
{
  "_reasoning": "默认共同吃饭属于共同消费。总金额 200。‘我付的’表示说话人付全款。两人平摊，说话人承担一半，即 100。",
  "records": [{"type": "aa", "payer": "me", "title": "吃火锅", "total": 200, "my_share": 100, "items": [{"name": "火锅", "amount": 200, "category": "餐饮"}]}]
}

【范例 3：单方消费，自己全额代付（免单）】
输入："帮他带了杯奶茶20"
输出：
{
  "_reasoning": "‘帮他带’说明奶茶是对方一个人的消费，但由我垫付。总金额 20。既然是对方的消费，我不需要承担任何费用，因此 my_share 为 0。",
  "records": [{"type": "aa", "payer": "me", "title": "买奶茶", "total": 20, "my_share": 0, "items": [{"name": "奶茶", "amount": 20, "category": "餐饮"}]}]
}

【范例 4：单方消费，对方全额代付（欠全款）】
输入："他帮我付了打车费30"
输出：
{
  "_reasoning": "‘帮我付’说明打车是我个人的消费，对方垫付了钱。总金额 30。由于是我个人的消费，我应该承担全部费用，即 30。",
  "records": [{"type": "aa", "payer": "her", "title": "打车费", "total": 30, "my_share": 30, "items": [{"name": "打车", "amount": 30, "category": "交通"}]}]
}

【范例 5：送礼物】
输入："我送她一束花200块"
输出：
{
  "_reasoning": "明确提及‘送’，属于礼物记录。我是送出方（from: me），对方是接收方（to: her）。总金额 200。",
  "records": [{"type": "gift", "from": "me", "to": "her", "title": "一束花", "amount": 200}]
}
`

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
        const { userId, coupleId, identity, supabase } = context
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
          response_format: { type: 'json_object' },
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

      // 2. Define Zod Schemas for defensive parsing
      const giftSchema = z.object({
        type: z.literal('gift'),
        from: z.enum(['me', 'her']).optional().default('me'),
        to: z.enum(['me', 'her']).optional().default('her'),
        title: z.string().optional().default('礼物记录'),
        category: z.string().optional().nullable(),
        amount: z.number().nullable().optional(),
        total: z.number().nullable().optional(), // Coercion field
        items: z.array(z.object({ amount: z.number().nullable().optional() })).optional(), // Coercion field
        description: z.string().optional().nullable(),
        date: z.string().optional().nullable()
      }).transform(data => ({
        ...data,
        amount: data.amount ?? data.total ?? (data.items?.[0]?.amount ?? null)
      }))

      const aaItemSchema = z.object({
        name: z.string().optional().default('支出项'),
        amount: z.number().nullable().optional(),
        category: z.string().optional().nullable()
      })

      const aaSchema = z.object({
        type: z.literal('aa'),
        payer: z.enum(['me', 'her']).optional().default('me'),
        title: z.string().optional().default('支出记录'),
        items: z.array(aaItemSchema).optional(),
        total: z.number().nullable().optional().default(0),
        my_share: z.number().nullable().optional(),
        note: z.string().optional().nullable(),
        status: z.enum(['pending', 'settled']).optional().default('pending'),
        date: z.string().optional().nullable()
      })

      const aiOutputSchema = z.object({
        _reasoning: z.string().optional(),
        records: z.array(z.union([giftSchema, aaSchema]))
      })

      // 3. Parse and Coerce
      let parsedJson;
      try {
        parsedJson = JSON.parse(content);
      } catch (e) {
        throw new Error('AI returned malformed JSON: ' + content);
      }
      
      const validationResult = aiOutputSchema.safeParse(parsedJson);
      if (!validationResult.success) {
        console.error('Zod Parsing Error:', validationResult.error);
        throw new Error('AI 返回的数据结构无法解析，请重试');
      }

      const resultsList = validationResult.data.records;
      const parsedDrafts: any[] = []
      const draftsToInsert: any[] = []

      // 4. Generate drafts details
      for (const record of resultsList) {
        const tempId = `draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        
        // Map speaker-centric values ('me' = speaker, 'her' = partner) to database static identities
        const resolveIdentity = (val: string) => {
          if (identity !== 'her') return val
          if (val === 'me') return 'her'
          if (val === 'her') return 'me'
          return val
        }

        let draftDisplayPayload: any;

        if (record.type === 'gift') {
          const { from, to, title, amount, description, date, category } = record
          
          draftDisplayPayload = {
            id: tempId,
            record_type: 'gift',
            is_draft: true,
            from_user: resolveIdentity(from),
            to_user: resolveIdentity(to),
            title,
            amount: amount,
            description: description ?? null,
            category: category ?? null,
            source_text: args.text,
            image_urls: imageUrls,
            date: date ?? new Date().toISOString().split('T')[0],
          }
        } else if (record.type === 'aa') {
          const { payer, items: aaItems, total, my_share, note, date } = record
          const dbPayer = resolveIdentity(payer)
          const safeTotal = total ?? 0
          const safeMyShare = my_share ?? 0
          const dbMyShare = identity === 'her' ? (safeTotal - safeMyShare) : safeMyShare

          draftDisplayPayload = {
            id: tempId,
            record_type: 'aa',
            is_draft: true,
            payer: dbPayer,
            status: record.status,
            total_amount: safeTotal,
            my_share: dbMyShare,
            source_text: args.text,
            image_urls: imageUrls,
            note: note ?? null,
            title: record.title,
            aa_items: aaItems?.map((item, idx) => ({
              id: `draft-item-${tempId}-${idx}`,
              name: item.name,
              amount: item.amount ?? (aaItems.length === 1 ? total : 0),
              category: item.category ?? null
            })) ?? [{ id: `draft-item-${tempId}-0`, name: '生活杂项', amount: total, category: null }],
            date: date ?? new Date().toISOString().split('T')[0],
          }
        }

        parsedDrafts.push(draftDisplayPayload)
        
        draftsToInsert.push({
          id: tempId,
          couple_id: coupleId,
          creator_id: userId,
          record_type: record.type,
          payload: draftDisplayPayload,
          created_at: new Date().toISOString()
        })
      }

      // 5. Save Drafts to Server
      if (draftsToInsert.length > 0) {
        if (!supabase) throw new Error('Supabase client not found in context');
        const { error: insertError } = await supabase.from('aa_drafts').insert(draftsToInsert);
        if (insertError) {
          console.error('Failed to save drafts:', insertError);
          throw new Error('草稿保存失败');
        }
      }

      return {
        success: true,
        count: parsedDrafts.length,
        records: parsedDrafts.map(d => ({ draft_id: d.id, ...d })) // ensure draft_id is explicitly passed if needed
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
