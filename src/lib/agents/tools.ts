import { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Re-use system prompt for parsing text into structured records
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
  "date": "YYYY-MM-DD"
}

判定逻辑与身份映射：
1. "当前身份" 指的是输入这段话的用户。
2. 在返回的 JSON 中，必须遵循以下身份映射约定（非常重要）：
   - 使用 'me' 指代“当前身份”（即正在说话的用户）。
   - 使用 'her' 指代“对方/伙伴”。
3. 即使当前身份是“她”，在 JSON 中也要用 'me' 来指代她自己，用 'her' 指代对方。
4. 债务（AA）分摊逻辑：
   - 默认 AA：如果没有特别说明，默认双方平摊，my_share 为总金额的一半（即说话人自己应负担的金额）。
   - 借款/代付全部：
     - 如果是“我借给对方X元”或“我帮对方付了全部X元”，则 payer 为 'me', my_share 为 0 (表示说话人自己应负担 0，金额全由对方负责)。
     - 如果是“对方借给我X元”或“对方帮我付了全部X元”，则 payer 为 'her', my_share 为 X (表示说话人自己应负担 X)。
5. 语义解析示例：
   - "我请..."、"我买了礼物送给..." -> type: "gift", from: 'me', to: 'her'。
   - "她请我..." -> type: "gift", from: 'her', to: 'me'。
   - "我付了..." -> type: "aa", payer: 'me' (默认平摊)。
6. 如果未指明支付人或送礼人，默认 payer/from 为 'me'。`

export interface AgentContext {
  supabase: SupabaseClient
  userId: string
  coupleId: string
  identity: 'me' | 'her'
  displayName: string
  partnerName: string
  image_urls?: string[]
}

// 1. Get Couple Profile Tool
export async function get_couple_profile(context: AgentContext) {
  try {
    return {
      success: true,
      my_identity: context.identity,
      my_name: context.displayName,
      partner_name: context.partnerName,
      couple_id: context.coupleId
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// 2. Query Records Tool
export async function query_records(
  context: AgentContext,
  args: {
    query?: string
    record_type?: 'aa' | 'gift'
    start_date?: string
    end_date?: string
    status?: 'pending' | 'settled'
  }
) {
  const { supabase, coupleId } = context
  try {
    let giftQuery = supabase
      .from('gifts')
      .select('id, from_user, to_user, title, amount, description, category, source_text, image_urls, date, created_at')
      .eq('couple_id', coupleId)

    let billQuery = supabase
      .from('aa_bills')
      .select('id, payer, status, total_amount, my_share, source_text, note, image_urls, date, created_at, aa_items(id, name, amount, category)')
      .eq('couple_id', coupleId)

    // Keywords search
    if (args.query) {
      giftQuery = giftQuery.ilike('title', `%${args.query}%`)
      billQuery = billQuery.ilike('source_text', `%${args.query}%`)
    }

    // Dates filters
    if (args.start_date) {
      giftQuery = giftQuery.gte('date', args.start_date)
      billQuery = billQuery.gte('date', args.start_date)
    }
    if (args.end_date) {
      giftQuery = giftQuery.lte('date', args.end_date)
      billQuery = billQuery.lte('date', args.end_date)
    }

    // Status filter (Only applies to AA bills)
    if (args.status) {
      billQuery = billQuery.eq('status', args.status)
    }

    // Fetch in parallel
    const [giftsRes, billsRes] = await Promise.all([giftQuery, billQuery])

    if (giftsRes.error) throw giftsRes.error
    if (billsRes.error) throw billsRes.error

    const giftItems = (giftsRes.data || []).map((g: any) => ({ ...g, record_type: 'gift' }))
    let billItems = (billsRes.data || []).map((b: any) => ({ ...b, record_type: 'aa' }))

    // If querying only specific record_type
    let combined = []
    if (args.record_type === 'gift') {
      combined = giftItems
    } else if (args.record_type === 'aa') {
      combined = billItems
    } else {
      combined = [...giftItems, ...billItems]
    }

    // Sort by date (descending) then created_at (descending)
    combined.sort((a: any, b: any) => {
      const d1 = new Date(a.date).getTime()
      const d2 = new Date(b.date).getTime()
      if (d1 !== d2) return d2 - d1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Return first 30 matches to prevent token overflow
    return {
      success: true,
      records: combined.slice(0, 30)
    }
  } catch (err: any) {
    console.error('[Agent Tool: query_records] Error:', err)
    return { success: false, error: err.message }
  }
}

// 3. Add Record Tool (Generates in-memory Drafts for User Confirmation)
export async function add_record(
  context: AgentContext,
  args: { text: string; image_urls?: string[] }
) {
  const { supabase, userId, coupleId, identity } = context
  const imageUrls = args.image_urls || context.image_urls || []

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
      if (record.type === 'gift') {
        const { from, to, title, amount, description, date, category } = record
        parsedDrafts.push({
          id: tempId,
          record_type: 'gift',
          is_draft: true,
          from_user: from || 'me',
          to_user: to || 'her',
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
        parsedDrafts.push({
          id: tempId,
          record_type: 'aa',
          is_draft: true,
          payer: payer || 'me',
          status: 'pending',
          total_amount: total,
          my_share: my_share,
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

// 4. Settle Bills Tool
export async function settle_bills(
  context: AgentContext,
  args: { bill_ids: string[] }
) {
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

// 5. Notify Partner Tool
export async function notify_partner(
  context: AgentContext,
  args: { body: string }
) {
  const { supabase, coupleId, identity } = context
  try {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      throw new Error('Push notifications VAPID keys not configured in server environment')
    }

    webpush.setVapidDetails(
      'mailto:support@werecord.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )

    // The partner is the opposite of my identity
    const partnerIdentity = identity === 'me' ? 'her' : 'me'

    // Retrieve partner subscriptions
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_identity', partnerIdentity)
      .eq('couple_id', coupleId)

    if (error) throw error
    if (!subs || subs.length === 0) {
      return { success: false, count: 0, message: 'Partner does not have any active push notification subscriptions' }
    }

    const payload = JSON.stringify({
      title: '💸 WeRecord 财务管家提醒',
      body: args.body,
      url: '/'
    })

    const results = await Promise.allSettled(
      subs.map(row => webpush.sendNotification(row.subscription as any, payload))
    )

    // Clean up failed subscriptions
    for (let i = 0; i < results.length; i++) {
      const res = results[i]
      if (res.status === 'rejected') {
        const errorDetail = res.reason as any
        if (errorDetail.statusCode === 410 || errorDetail.statusCode === 404) {
          const expiredSub = subs[i].subscription as any
          await supabase.from('push_subscriptions').delete().eq('subscription->>endpoint', expiredSub.endpoint)
        }
      }
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length

    return {
      success: true,
      count: successCount,
      total_attempted: results.length
    }
  } catch (err: any) {
    console.error('[Agent Tool: notify_partner] Error:', err)
    return { success: false, error: err.message }
  }
}
