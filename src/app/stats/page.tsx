import ClientStatsPage from './ClientStatsPage'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function getStatsData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [giftsRes, billsRes] = await Promise.all([
    supabase.from('gifts').select('from_user, amount, category, date, created_at').order('date', { ascending: false }),
    supabase.from('aa_bills').select('payer, status, my_share, total_amount, date, created_at, aa_items(amount, category)').order('date', { ascending: false }),
  ])

  const gifts = giftsRes.data ?? []
  const bills = billsRes.data ?? []

  let totalByMe = 0
  let totalByHer = 0
  const giftCategories: Record<string, number> = {}
  const aaCategories: Record<string, number> = {}

  const monthlyTrends: Record<string, number> = {}
  const dailyTotals: Record<string, number> = {}
  const hourlyDistribution = new Array(24).fill(0)
  const categoryUserSplit: Record<string, { me: number, her: number }> = {}
  const timeDistribution = { workday: 0, weekend: 0 }
  const dailyNetChanges: Record<string, number> = {}

  const processEntry = (record: any, isGift: boolean) => {
    const amount = isGift ? Number(record.amount) : Number(record.total_amount)
    const dateStr = record.date
    if (!dateStr || amount <= 0) return

    const month = dateStr.substring(0, 7)
    monthlyTrends[month] = (monthlyTrends[month] || 0) + amount
    dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + amount

    const createdAt = new Date(record.created_at)
    if (!isNaN(createdAt.getTime())) {
      hourlyDistribution[createdAt.getHours()]++
    }

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

    if (!isGift && record.status === 'pending') {
      const share = Number(record.my_share || 0)
      const total = Number(record.total_amount || 0)
      const netChange = payer === 'me' ? (total - share) : -share
      dailyNetChanges[dateStr] = (dailyNetChanges[dateStr] || 0) + netChange
    }
  }

  gifts.forEach(g => {
    const amt = Number(g.amount || 0)
    if (g.from_user === 'me') totalByMe += amt
    else totalByHer += amt
    if (g.category) giftCategories[g.category] = (giftCategories[g.category] || 0) + amt
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
      pendingBalance += (b.payer === 'me' ? (total - share) : -share)
    } else {
      settledCount++
    }

    (b.aa_items || []).forEach((item: any) => {
      const amt = Number(item.amount || 0)
      if (item.category) aaCategories[item.category] = (aaCategories[item.category] || 0) + amt
    })
    processEntry(b, false)
  })

  const sortedDates = Object.keys(dailyNetChanges).sort()
  let runningBalance = 0
  const balanceHistory = sortedDates.map(date => {
    runningBalance += dailyNetChanges[date]
    return { date, balance: runningBalance }
  })

  const sortedTrends = Object.keys(monthlyTrends).sort().reduce((obj: any, key) => {
    obj[key] = monthlyTrends[key]
    return obj
  }, {})

  return {
    gifts: { totalByMe, totalByHer, categories: giftCategories, count: gifts.length },
    aa: { pendingCount, settledCount, categories: aaCategories, pendingBalance },
    analytics: { monthlyTrends: sortedTrends, dailyTotals, hourlyDistribution, categoryUserSplit, balanceHistory, timeDistribution }
  }
}

export default async function StatsServerPage() {
  const cookieStore = await cookies()
  const identity = cookieStore.get('werecord_identity')?.value

  // We can fetch initial stats data directly on the server!
  // It completely bypasses the client-side network request waterfall.
  const initialData = await getStatsData()

  return <ClientStatsPage fallbackData={initialData} />
}
