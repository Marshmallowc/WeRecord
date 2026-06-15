import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  const coupleId = profile?.couple_id
  
  if (!coupleId) return NextResponse.json({
    gifts: { totalByMe: 0, totalByHer: 0, categories: {}, count: 0 },
    aa: { pendingCount: 0, settledCount: 0, categories: {}, pendingBalance: 0 },
    analytics: { monthlyTrends: {}, dailyTotals: {}, hourlyDistribution: new Array(24).fill(0), categoryUserSplit: {}, balanceHistory: [], timeDistribution: { workday: 0, weekend: 0 } }
  })

  const [giftsRes, billsRes] = await Promise.all([
    supabase.from('gifts')
      .select('id, from_user, title, description, amount, category, image_urls, date, created_at')
      .eq('couple_id', coupleId)
      .order('date', { ascending: false }),
    supabase.from('aa_bills')
      .select('payer, status, my_share, total_amount, date, created_at, aa_items(name, amount, category)')
      .eq('couple_id', coupleId)
      .order('date', { ascending: false }),
  ])

  const gifts = giftsRes.data ?? []
  const bills = billsRes.data ?? []

  // Global aggregate stats
  let totalByMe = 0
  let totalByHer = 0
  const giftCategories: Record<string, number> = {}
  const aaCategories: Record<string, number> = {}
  const merchantStats: Record<string, { count: number, totalAmount: number }> = {}

  // Time-based stats
  const monthlyTrends: Record<string, number> = {} // "2024-03": amount
  const dailyTotals: Record<string, number> = {} // "2024-03-01": amount
  const hourlyDistribution = new Array(24).fill(0)
  const categoryUserSplit: Record<string, { me: number, her: number }> = {}
  const timeDistribution = { workday: 0, weekend: 0 }

  // For balance history
  const dailyNetChanges: Record<string, number> = {}

  const processEntry = (record: any, isGift: boolean) => {
    const amount = isGift ? Number(record.amount) : Number(record.total_amount)
    const dateStr = record.date
    if (!dateStr || amount <= 0) return

    // Monthly Trend
    const month = dateStr.substring(0, 7)
    monthlyTrends[month] = (monthlyTrends[month] || 0) + amount

    // Daily Total
    dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + amount

    // Hourly Distribution
    const createdAt = new Date(record.created_at)
    if (!isNaN(createdAt.getTime())) {
      hourlyDistribution[createdAt.getHours()]++
    }

    // Category Split
    const cat = record.category || '未分类'
    if (!categoryUserSplit[cat]) categoryUserSplit[cat] = { me: 0, her: 0 }
    const payer = isGift ? record.from_user : record.payer
    if (payer === 'me') categoryUserSplit[cat].me += amount
    else categoryUserSplit[cat].her += amount

    const date = new Date(dateStr)
    const day = date.getUTCDay()
    const isWeekend = day === 0 || day === 6
    if (isWeekend) timeDistribution.weekend += amount
    else timeDistribution.workday += amount

    // Balance History (AA only)
    if (!isGift && record.status === 'pending') {
      const share = Number(record.my_share || 0)
      const total = Number(record.total_amount || 0)
      // If I pay, she owes me (total - my_share)
      // If she pays, I owe her (my_share)
      const netChange = payer === 'me' ? (total - share) : -share
      dailyNetChanges[dateStr] = (dailyNetChanges[dateStr] || 0) + netChange
    }
  }

  gifts.forEach(g => {
    const amt = Number(g.amount || 0)
    if (g.from_user === 'me') totalByMe += amt
    else totalByHer += amt

    if (g.category) {
      giftCategories[g.category] = (giftCategories[g.category] || 0) + amt
    }
    processEntry(g, true)
  })

  let pendingBalance = 0
  let pendingCount = 0
  let settledCount = 0

  bills.forEach(b => {
    const total = Number(b.total_amount || 0)
    const share = Number(b.my_share || 0)
    if (b.status === 'pending') {
      pendingCount++
      // Corrected logic: 
      // If I pay, the balance increases by what SHE owes me (total - my_share)
      // If she pays, the balance decreases by what I owe HER (my_share)
      pendingBalance += (b.payer === 'me' ? (total - share) : -share)
    } else {
      settledCount++
    }

    (b.aa_items || []).forEach((item: any) => {
      const amt = Number(item.amount || 0)
      if (item.category) {
        aaCategories[item.category] = (aaCategories[item.category] || 0) + amt
      }
      const name = item.name?.trim()
      if (name) {
        if (!merchantStats[name]) {
          merchantStats[name] = { count: 0, totalAmount: 0 }
        }
        merchantStats[name].count++
        merchantStats[name].totalAmount += amt
      }
    })
    processEntry(b, false)
  })

  // Calculate Balance History (Cumulative)
  const sortedDates = Object.keys(dailyNetChanges).sort()
  let runningBalance = 0
  const balanceHistory = sortedDates.map(date => {
    runningBalance += dailyNetChanges[date]
    return { date, balance: runningBalance }
  })

  // Sort monthly trends chronologically
  const sortedTrends = Object.keys(monthlyTrends)
    .sort()
    .reduce((obj: any, key) => {
      obj[key] = monthlyTrends[key]
      return obj
    }, {})

  const recentGifts = gifts.slice(0, 10).map(g => ({
    id: g.id,
    title: g.title,
    description: g.description,
    amount: Number(g.amount || 0),
    category: g.category,
    image_urls: g.image_urls,
    date: g.date,
    from_user: g.from_user
  }))

  const topMerchants = Object.entries(merchantStats)
    .map(([name, stat]) => ({
      name,
      count: stat.count,
      totalAmount: stat.totalAmount
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return NextResponse.json({
    gifts: {
      totalByMe,
      totalByHer,
      categories: giftCategories,
      count: gifts.length,
      recentGifts,
    },
    aa: {
      pendingCount,
      settledCount,
      categories: aaCategories,
      pendingBalance,
      topMerchants,
    },
    analytics: {
      monthlyTrends: sortedTrends,
      dailyTotals,
      hourlyDistribution,
      categoryUserSplit,
      balanceHistory,
      timeDistribution
    }
  })
}
