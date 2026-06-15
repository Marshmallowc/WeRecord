import { z } from 'zod'
import { Skill, ToolDefinition } from '../registry'

/**
 * Helper function to calculate dbMyShare (amount to be paid by the male partner 'me' in the database).
 * This abstracts and decouples the split calculations from raw ternary operations.
 *
 * @param splitType - The type of splitting ('average' | 'payer_all' | 'partner_all' | 'custom')
 * @param total - Total amount of the transaction
 * @param aiMyShare - Amount the speaker ('me' in AI perspective) should pay, parsed from AI
 * @param dbPayer - Transformed database payer ('me' | 'her')
 * @param identity - Identity of the current speaker ('me' | 'her')
 */
export function calculateDbMyShare(params: {
  splitType: 'average' | 'payer_all' | 'partner_all' | 'custom';
  total: number;
  aiMyShare: number;
  dbPayer: 'me' | 'her';
  identity: 'me' | 'her';
}): number {
  const { splitType, total, aiMyShare, dbPayer, identity } = params;

  switch (splitType) {
    case 'average':
      return total / 2;

    case 'payer_all':
      // The payer pays 100%, partner pays 0%
      return dbPayer === 'me' ? total : 0;

    case 'partner_all':
      // The payer's partner pays 100%, payer pays 0%
      return dbPayer === 'me' ? 0 : total;

    case 'custom':
    default:
      // Fallback to speaker-centric logic
      return identity === 'her' ? (total - aiMyShare) : aiMyShare;
  }
}

const PARSER_SYSTEM_PROMPT = `你是一个专业、严谨的情侣支出与礼物管理助手。请根据用户输入提取账单和礼物记录。

### 核心规则 (Core Rules)
1. 返回格式：必须是一个严格的 JSON 对象。
2. 思维链 (CoT)：必须首先输出 \`_reasoning\` 字段，简要分析以下四个问题：
   a. 消费属于单人还是共同？是否有纯生活日记或情绪倾诉需要过滤？
   b. 谁付的钱？是否包含口语化/输入法导致的 ASR 拼写错误？
   c. 是否包含多笔独立的交易（如我请他、他请我、或者两个时间地点的消费）？如果是，必须拆分为 records 数组中的多个独立对象。
   d. 按照常理说话人该承担多少？
   分析完毕后，再输出 \`records\` 数组。
3. 身份映射：
   - 'me' 指代“当前说话人”（即发送这段文字的用户）。
   - 'her' 指代“对方/伴侣”。
   - 即使当前说话人是女生，在 JSON 中也要用 'me' 指代她自己，用 'her' 指代男生。
4. 去除表情与日记过滤：所有文字内容禁止包含 Emoji。用户的输入可能包含大段生活琐事流水账（如“去网吧通宵”、“身体不舒服回去了”等），在提取账单时必须过滤掉这些非财务背景，仅针对有资金流向、请客、送礼的部分记账。生成的标题和备注要简明扼要，严禁将不相干的日记内容塞入账单 title 中。
5. 金额与 ASR 纠错处理：
   - 必须处理语音转文字（ASR）导致的口语化或字词重复。例如：“花了花了14块”应精准提取金额为 14；“80块五”应提取为 80.5；“一百二”应提取为 120。
   - 同音字或别字纠错：例如“吃劳保街”或“吃捞宝街”结合上下文及“海底捞”纠错为“海底捞捞宝街”或“海底捞”。
   - 未明确指出金额的物品，金额设为 null，不要随便默认赋 0。如果全篇无金额且无法判定，records 可以为空。
6. 礼物（gift）与请客判定：
   - 当用户明确表达“请客”（如“我请他吃...”、“他请我喝...”）且发生于纪念日、节日或具有明显送礼/互赠性质的场景时，应将其解析为“礼物 (gift)”记录，其中请客方为 \`from\`，被请客方为 \`to\`。
7. 分摊方式 (split_type) 定义与判定原则：
   - 'average'：默认平摊（通常适用于“我们一起消费”且未特指某人请客的场景，my_share 设为 total 的一半）。
   - 'payer_all'：付款人自愿全额承担（通常适用于“我付款且我请客”或“他付款且他请客”，此时付款人自己承担全部费用。若说话人为付款人则 my_share 等于 total；若说话人不是付款人则 my_share 等于 0）。
   - 'partner_all'：付款人的伴侣（另一方）全额承担。请注意，如果是单纯的代付、垫资或借款，请直接使用 \`borrow\` 类型，不再使用此分摊方式。
   - 'custom'：自定义金额/比例（适用于明确指定了不相等的特定分摊金额，my_share 按说话人实际应出的部分填写）。
8. 借款与代付 (borrow) 判定：
   - 适用于明确一方全额为另一方垫付、代付、借款的场景（如“帮他带了杯奶茶”、“借给他100”）。
   - 不要再去算 my_share，直接将 type 设为 borrow，并标明付款人 payer 即可。

### 字段定义 (Schema)
礼物 (gift)：
{"type": "gift", "from": "me | her", "to": "me | her", "title": "礼物名", "category": "分类名", "amount": 数字, "description": "备注", "date": "YYYY-MM-DD"}

AA账单 (aa)：
{"type": "aa", "payer": "me | her", "split_type": "average | payer_all | partner_all | custom", "title": "标题", "items": [{"name": "商品", "amount": 数字, "category": "分类"}], "total": 合计总额, "my_share": 说话人应承担的金额, "note": "备注", "status": "pending | settled", "date": "YYYY-MM-DD"}

借款/代付 (borrow)：
{"type": "borrow", "payer": "me | her", "title": "标题", "items": [{"name": "商品", "amount": 数字, "category": "分类"}], "total": 金额, "note": "备注", "date": "YYYY-MM-DD"}

### 范例参考 (Few-Shot Examples)

【范例 1：共同消费，对方付款（平摊）】
输入："昨晚我们去麦德龙买了44块钱吃的，他给的"
输出：
{
  "_reasoning": "上下文中出现了‘我们’，属于共同消费，总金额 44。‘他给的’表示对方付了全款。既然是共同消费且未特指一方请客，默认两人平摊，因此说话人（me）应承担一半，即 22。",
  "records": [{"type": "aa", "payer": "her", "split_type": "average", "title": "麦德龙购物", "total": 44, "my_share": 22, "items": [{"name": "吃的", "amount": 44, "category": "餐饮"}]}]
}

【范例 2：共同消费，自己付款（平摊）】
输入："今天吃火锅200我付的"
输出：
{
  "_reasoning": "默认共同吃饭属于共同消费。总金额 200。‘我付的’表示说话人付全款。两人平摊，说话人承担一半，即 100。",
  "records": [{"type": "aa", "payer": "me", "split_type": "average", "title": "吃火锅", "total": 200, "my_share": 100, "items": [{"name": "火锅", "amount": 200, "category": "餐饮"}]}]
}

【范例 3：单方消费，自己全额代付（免单）】
输入："帮他带了杯奶茶20"
输出：
{
  "_reasoning": "‘帮他带’说明奶茶是对方一个人的消费，但由我垫付。总金额 20。这是一个典型的代付场景，直接使用 borrow 类型。付款人是我（me）。",
  "records": [{"type": "borrow", "payer": "me", "title": "买奶茶", "total": 20, "items": [{"name": "奶茶", "amount": 20, "category": "餐饮"}]}]
}

【范例 4：两周年多笔互请与 ASR 纠错】
输入："今天是我跟他的那个一起的两周年还有认识的800天，今天我们去摩天活力城吃劳保街，我请他吃花80块五，然后他请我喝饮料，花了花了14块是一个什么玩意，手作酸奶。"
输出：
{
  "_reasoning": "1. 过滤两周年、认识800天等生活和情感记录背景。2. 包含两笔发生于两周年的‘请客’事件，性质应判定为互送‘礼物 (gift)’。3. 第一笔：我请他吃‘吃劳保街’，同音纠错为‘海底捞捞宝街’，金额‘80块五’解析为 80.5，from 为 me，to 为 her。4. 第二笔：他请我喝‘手作酸奶’，‘花了花了14块’去重纠错为 14，from 为 her，to 为 me。拆分为两笔记录输出。",
  "records": [
    {"type": "gift", "from": "me", "to": "her", "title": "海底捞捞宝街", "amount": 80.5, "description": "两周年纪念日我请客"},
    {"type": "gift", "from": "her", "to": "me", "title": "手作酸奶", "amount": 14, "description": "两周年纪念日对方请客"}
  ]
}

【范例 5：流水账背景过滤与 AA 账单识别】
输入："我和我室友昨晚吃自助餐，然后去网吧通宵，然后今早11点多特别不舒服，然后就回来了，然后他特意给我在西区带了肠粉和炒米粉回来给我吃，花了22块。"
输出：
{
  "_reasoning": "1. 过滤掉‘自助餐、通宵、不舒服、回来’等无关的日记信息。2. 核心财务事件是‘带了肠粉和炒米粉回来，花了22块’。3. 付款人是对方（payer: 'her'）。4. 带饭属于日常共餐或代买，通常平摊（split_type: 'average'），总额22，说话人应分摊一半即 11。账单标题简明设为‘肠粉和炒米粉’，不带无关词语。",
  "records": [
    {
      "type": "aa",
      "payer": "her",
      "split_type": "average",
      "title": "肠粉和炒米粉",
      "total": 22,
      "my_share": 11,
      "items": [{"name": "肠粉和炒米粉", "amount": 22, "category": "餐饮"}],
      "note": "对方带饭"
    }
  ]
}

【范例 6：无金额的财务事件】
输入："中午我们一起去吃了烤肉，我买的单，太贵了心痛！"
输出：
{
  "_reasoning": "有一起吃烤肉且我买单的事件，但没有具体金额。金额设为 null，记录为 AA 账单，待用户确认修改。标题简明为‘吃烤肉’。",
  "records": [
    {
      "type": "aa",
      "payer": "me",
      "split_type": "average",
      "title": "吃烤肉",
      "total": null,
      "my_share": null,
      "items": [{"name": "烤肉", "amount": null, "category": "餐饮"}]
    }
  ]
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
      console.log("=== AI RAW CONTENT ===\n", content, "\n======================")
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
        split_type: z.enum(['average', 'payer_all', 'partner_all', 'custom']).optional().default('average'),
        title: z.string().optional().default('支出记录'),
        items: z.array(aaItemSchema).optional(),
        total: z.number().nullable().optional().default(0),
        my_share: z.number().nullable().optional(),
        note: z.string().optional().nullable(),
        status: z.enum(['pending', 'settled']).optional().default('pending'),
        date: z.string().optional().nullable()
      })

      const borrowSchema = z.object({
        type: z.literal('borrow'),
        payer: z.enum(['me', 'her']).optional().default('me'),
        title: z.string().optional().default('代付'),
        items: z.array(aaItemSchema).optional(),
        total: z.number().nullable().optional().default(0),
        note: z.string().optional().nullable(),
        date: z.string().optional().nullable()
      })

      const aiOutputSchema = z.object({
        _reasoning: z.string().optional(),
        records: z.array(z.union([giftSchema, aaSchema, borrowSchema]))
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
          const { payer, split_type, items: aaItems, total, my_share, note, date } = record
          const dbPayer = resolveIdentity(payer) as 'me' | 'her'
          const safeTotal = total ?? 0
          const safeMyShare = my_share ?? 0
          const dbMyShare = calculateDbMyShare({
            splitType: (split_type ?? 'average') as 'average' | 'payer_all' | 'partner_all' | 'custom',
            total: safeTotal,
            aiMyShare: safeMyShare,
            dbPayer,
            identity: identity as 'me' | 'her'
          })

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
        } else if (record.type === 'borrow') {
          const { payer, items: aaItems, total, note, date } = record
          const dbPayer = resolveIdentity(payer) as 'me' | 'her'
          const safeTotal = total ?? 0
          
          draftDisplayPayload = {
            id: tempId,
            record_type: 'borrow',
            is_draft: true,
            payer: dbPayer,
            status: 'pending',
            total_amount: safeTotal,
            // 此时前端不需要硬编码 my_share=0，但为了兼容部分计算，可以直接赋值
            my_share: dbPayer === 'me' ? 0 : safeTotal,
            source_text: args.text,
            image_urls: imageUrls,
            note: note ?? null,
            title: record.title,
            aa_items: aaItems?.map((item, idx) => ({
              id: `draft-item-${tempId}-${idx}`,
              name: item.name,
              amount: item.amount ?? (aaItems.length === 1 ? total : 0),
              category: item.category ?? null
            })) ?? [{ id: `draft-item-${tempId}-0`, name: '代付/借款', amount: total, category: null }],
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
