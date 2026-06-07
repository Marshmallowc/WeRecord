import { Skill, ToolDefinition } from '../registry'

// 1. Existing Query Records Tool (for backward compatibility)
export const queryRecordsTool: ToolDefinition<{
  query?: string
  record_type?: 'aa' | 'gift'
  start_date?: string
  end_date?: string
  status?: 'pending' | 'settled'
  order?: 'desc' | 'asc'
  limit?: number
}> = {
  name: 'query_records',
  description: '在账本中精准查找 AA 账单或礼物记录。可基于分类、关键字、时间段或结账状态进行过滤。该工具会返回匹配的详细记录 JSON 列表。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '用于模糊匹配账单或礼物标题的关键字（如 \'电影\', \'咖啡\'）' },
      record_type: { type: 'string', enum: ['aa', 'gift'], description: '要筛选的记录类型：\'aa\' (支出) 或 \'gift\' (礼物)。不传则查全部。' },
      start_date: { type: 'string', description: '查询的起始日期，格式 YYYY-MM-DD（如 \'2026-05-01\'）' },
      end_date: { type: 'string', description: '查询的结束日期，格式 YYYY-MM-DD' },
      status: { type: 'string', enum: ['pending', 'settled'], description: '仅针对AA账单进行过滤：\'pending\' (未平账/待结清) 或 \'settled\' (已平账/已结清)。' },
      order: { type: 'string', enum: ['desc', 'asc'], description: '排序顺序，默认为 \'desc\' (最新的在前)。若要查询最早、第一笔账单，请传入 \'asc\' (最旧的在前)。' },
      limit: { type: 'integer', description: '返回的最大记录数，默认为 30。' }
    }
  },
  execute: async (context, args) => {
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
      const billItems = (billsRes.data || []).map((b: any) => ({ ...b, record_type: 'aa' }))

      // If querying only specific record_type
      let combined = []
      if (args.record_type === 'gift') {
        combined = giftItems
      } else if (args.record_type === 'aa') {
        combined = billItems
      } else {
        combined = [...giftItems, ...billItems]
      }

      // Sort by date then created_at based on order parameter
      const isAsc = args.order === 'asc'
      combined.sort((a: any, b: any) => {
        const d1 = new Date(a.date).getTime()
        const d2 = new Date(b.date).getTime()
        if (d1 !== d2) return isAsc ? d1 - d2 : d2 - d1
        return isAsc
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      // Calculate aggregates before slicing to prevent AI hallucination
      let sum_aa_total = 0
      let sum_aa_my_share = 0
      let sum_gift_total = 0

      combined.forEach(r => {
        if (r.record_type === 'aa') {
          sum_aa_total += Number(r.total_amount) || 0
          sum_aa_my_share += Number(r.my_share) || 0
        } else if (r.record_type === 'gift') {
          sum_gift_total += Number(r.amount) || 0
        }
      })

      // Return first N matches to prevent token overflow
      const limitVal = args.limit || 30
      return {
        success: true,
        total_count: combined.length,
        sum_aa_total: parseFloat(sum_aa_total.toFixed(2)),
        sum_aa_my_share: parseFloat(sum_aa_my_share.toFixed(2)),
        sum_gift_total: parseFloat(sum_gift_total.toFixed(2)),
        has_more: combined.length > limitVal,
        records: combined.slice(0, limitVal)
      }
    } catch (err: any) {
      console.error('[Agent Tool: query_records] Error:', err)
      return { success: false, error: err.message }
    }
  }
}

// 2. Existing Financial Stats Tool (for backward compatibility)
export const getFinancialStatsTool: ToolDefinition<{
  start_date?: string
  end_date?: string
}> = {
  name: 'get_financial_stats',
  description: '获取指定时间段内（或所有时间）的情侣账目统计摘要和分类消费占比。包含AA总支出、当前谁欠谁多少钱（结余）、各自送礼总额及各个分类的消费总和。当用户询问“我们这月/这周花了多少”、“当前谁欠谁钱”、“分类支出占比”等宏观统计问题时，必须优先调用此工具，严禁使用query_records查询全部明细来人工累加计算。',
  parameters: {
    type: 'object',
    properties: {
      start_date: { type: 'string', description: '起始日期，格式 YYYY-MM-DD（如 \'2026-05-01\'）' },
      end_date: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' }
    }
  },
  execute: async (context, args) => {
    const { supabase, coupleId, identity } = context
    try {
      let giftQuery = supabase
        .from('gifts')
        .select('from_user, amount, category, date')
        .eq('couple_id', coupleId)

      let billQuery = supabase
        .from('aa_bills')
        .select('payer, status, my_share, total_amount, date, aa_items(amount, category)')
        .eq('couple_id', coupleId)

      if (args.start_date) {
        giftQuery = giftQuery.gte('date', args.start_date)
        billQuery = billQuery.gte('date', args.start_date)
      }
      if (args.end_date) {
        giftQuery = giftQuery.lte('date', args.end_date)
        billQuery = billQuery.lte('date', args.end_date)
      }

      const [giftsRes, billsRes] = await Promise.all([giftQuery, billQuery])
      if (giftsRes.error) throw giftsRes.error
      if (billsRes.error) throw billsRes.error

      const gifts = giftsRes.data || []
      const bills = billsRes.data || []

      let totalGiftsMe = 0
      let totalGiftsPartner = 0
      let totalSpentAA = 0
      let pendingBalance = 0 // Caller perspective
      let pendingCount = 0

      const categoryTotals: Record<string, number> = {}

      // Process gifts
      gifts.forEach((g: any) => {
        const amt = Number(g.amount || 0)
        if (g.from_user === 'me') {
          totalGiftsMe += amt
        } else {
          totalGiftsPartner += amt
        }
        const cat = g.category || '礼物'
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt
      })

      // Process bills
      bills.forEach((b: any) => {
        const total = Number(b.total_amount || 0)
        const share = Number(b.my_share || 0)
        totalSpentAA += total

        if (b.status === 'pending') {
          pendingCount++
          // Calculate raw pending balance from the perspective of the profile identity 'me'
          const rawChange = b.payer === 'me' ? (total - share) : -share
          // Adjust relative to the caller's identity ('me' or 'her')
          pendingBalance += identity === 'me' ? rawChange : -rawChange
        }

        // Category breakdown from items or bill level
        if (b.aa_items && b.aa_items.length > 0) {
          b.aa_items.forEach((item: any) => {
            const cat = item.category || '未分类'
            categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(item.amount || 0)
          })
        } else {
          const cat = b.category || '未分类'
          categoryTotals[cat] = (categoryTotals[cat] || 0) + total
        }
      })

      // Format results relative to caller's identity
      const totalGiftsByMe = identity === 'me' ? totalGiftsMe : totalGiftsPartner
      const totalGiftsByPartner = identity === 'me' ? totalGiftsPartner : totalGiftsMe

      return {
        success: true,
        timeframe: {
          start: args.start_date || '所有时间',
          end: args.end_date || '所有时间'
        },
        summary: {
          total_spent_aa: totalSpentAA,
          pending_count: pendingCount,
          pending_balance: pendingBalance, // positive: partner owes me, negative: I owe partner
          gifts_by_me: totalGiftsByMe,
          gifts_by_partner: totalGiftsByPartner
        },
        category_breakdown: categoryTotals
      }
    } catch (err: any) {
      console.error('[Agent Tool: get_financial_stats] Error:', err)
      return { success: false, error: err.message }
    }
  }
}

// 3. NEW Advanced Query Tool
export const queryFinancialDataTool: ToolDefinition<{
  record_type?: 'aa' | 'gift' | 'all'
  payer?: 'me' | 'her'
  receiver?: 'me' | 'her'
  status?: 'pending' | 'settled'
  category?: string
  start_date?: string
  end_date?: string
  limit?: number
}> = {
  name: 'query_financial_data',
  description: '对情侣账单或礼物进行高级过滤、统计和汇总分析。支持按状态、类别、支付人/送礼人（以当前说话人为视角，传入"me"指我，"her"指对方）进行精确过滤，并返回计算好的条数与金额总数，用于完美解决“对方有多少笔未结清账单”、“我送了多少次礼物”等统计问题，严禁自行累加。',
  parameters: {
    type: 'object',
    properties: {
      record_type: { type: 'string', enum: ['aa', 'gift', 'all'], description: '筛选记录类型。aa表示AA账单支出，gift表示礼物，all表示两者都包含。默认为all。' },
      payer: { type: 'string', enum: ['me', 'her'], description: '筛选付款人（针对账单）或送礼人（针对礼物）。me代表当前说话用户自己，her代表对方。' },
      receiver: { type: 'string', enum: ['me', 'her'], description: '筛选礼物接受者。me代表当前说话用户自己，her代表对方。仅针对礼物有效。' },
      status: { type: 'string', enum: ['pending', 'settled'], description: '筛选结算状态。pending待平账，settled已结清。仅针对AA账单有效。' },
      category: { type: 'string', description: '筛选消费具体分类（如餐饮、娱乐、交通等）' },
      start_date: { type: 'string', description: '查询起始日期，格式 YYYY-MM-DD' },
      end_date: { type: 'string', description: '查询结束日期，格式 YYYY-MM-DD' },
      limit: { type: 'integer', description: '返回明细的最大条数（默认 30）。' }
    }
  },
  execute: async (context, args) => {
    const { supabase, coupleId, identity } = context
    const limitVal = args.limit || 30

    // Map speaker-centric relative identity ('me'/'her') to absolute database identities ('me'/'her')
    const resolveIdentity = (val: string) => {
      if (identity !== 'her') return val
      if (val === 'me') return 'her'
      if (val === 'her') return 'me'
      return val
    }

    try {
      let giftQuery = supabase
        .from('gifts')
        .select('id, from_user, to_user, title, amount, description, category, source_text, image_urls, date, created_at')
        .eq('couple_id', coupleId)

      let billQuery = supabase
        .from('aa_bills')
        .select('id, payer, status, total_amount, my_share, source_text, note, image_urls, date, created_at, aa_items(id, name, amount, category)')
        .eq('couple_id', coupleId)

      // Apply Payer filter
      if (args.payer) {
        const dbPayer = resolveIdentity(args.payer)
        billQuery = billQuery.eq('payer', dbPayer)
        giftQuery = giftQuery.eq('from_user', dbPayer)
      }

      // Apply Receiver filter
      if (args.receiver) {
        const dbReceiver = resolveIdentity(args.receiver)
        giftQuery = giftQuery.eq('to_user', dbReceiver)
      }

      // Apply Status filter (Only applies to AA bills)
      if (args.status) {
        billQuery = billQuery.eq('status', args.status)
      }

      // Apply Dates filters
      if (args.start_date) {
        giftQuery = giftQuery.gte('date', args.start_date)
        billQuery = billQuery.gte('date', args.start_date)
      }
      if (args.end_date) {
        giftQuery = giftQuery.lte('date', args.end_date)
        billQuery = billQuery.lte('date', args.end_date)
      }

      // Fetch in parallel
      const [giftsRes, billsRes] = await Promise.all([giftQuery, billQuery])
      if (giftsRes.error) throw giftsRes.error
      if (billsRes.error) throw billsRes.error

      let giftItems = (giftsRes.data || []).map((g: any) => ({ ...g, record_type: 'gift' }))
      let billItems = (billsRes.data || []).map((b: any) => ({ ...b, record_type: 'aa' }))

      // Filter by category in-memory (to handle nested item categories robustly)
      if (args.category) {
        giftItems = giftItems.filter((g: any) => g.category === args.category)
        billItems = billItems.filter((b: any) => {
          const hasItemMatch = b.aa_items?.some((item: any) => item.category === args.category)
          return b.category === args.category || hasItemMatch
        })
      }

      // Combine based on record_type
      let combined = []
      const reqType = args.record_type || 'all'
      if (reqType === 'gift') {
        combined = giftItems
      } else if (reqType === 'aa') {
        combined = billItems
      } else {
        combined = [...giftItems, ...billItems]
      }

      // Sort by date then created_at desc (latest first)
      combined.sort((a: any, b: any) => {
        const d1 = new Date(a.date).getTime()
        const d2 = new Date(b.date).getTime()
        if (d1 !== d2) return d2 - d1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      // Aggregate calculations
      let sum_aa_total = 0
      let sum_aa_my_share = 0 // Caller's share
      let sum_gift_total = 0
      let pending_count = 0
      let pending_balance = 0 // Caller's perspective (positive: partner owes me, negative: I owe partner)

      combined.forEach((r: any) => {
        if (r.record_type === 'aa') {
          const total = Number(r.total_amount) || 0
          const dbMyShare = Number(r.my_share) || 0
          
          // my_share is stored relative to static User 1 ('me') in DB.
          // Translate to caller's relative perspective:
          const relativeMyShare = identity === 'her' ? (total - dbMyShare) : dbMyShare

          sum_aa_total += total
          sum_aa_my_share += relativeMyShare

          if (r.status === 'pending') {
            pending_count++
            // If payer is absolute identity of caller, partner owes caller: (total - relativeMyShare)
            // If payer is NOT caller, caller owes partner: -relativeMyShare
            const isCallerPayer = r.payer === identity
            pending_balance += isCallerPayer ? (total - relativeMyShare) : -relativeMyShare
          }
        } else if (r.record_type === 'gift') {
          sum_gift_total += Number(r.amount) || 0
        }
      })

      return {
        success: true,
        total_count: combined.length,
        pending_count,
        pending_balance: parseFloat(pending_balance.toFixed(2)),
        sum_aa_total: parseFloat(sum_aa_total.toFixed(2)),
        sum_aa_my_share: parseFloat(sum_aa_my_share.toFixed(2)),
        sum_gift_total: parseFloat(sum_gift_total.toFixed(2)),
        has_more: combined.length > limitVal,
        records: combined.slice(0, limitVal)
      }
    } catch (err: any) {
      console.error('[Agent Tool: query_financial_data] Error:', err)
      return { success: false, error: err.message }
    }
  }
}

export const AnalyticsSkill: Skill = {
  name: 'AnalyticsSkill',
  description: '日常数据查找、宏观消费统计、精细维度财务报表查询等分析技能',
  tools: [queryRecordsTool, getFinancialStatsTool, queryFinancialDataTool]
}
