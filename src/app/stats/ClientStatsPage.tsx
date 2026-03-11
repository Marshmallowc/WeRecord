'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import useSWR from 'swr'
import { useIdentity } from '@/context/IdentityContext'
import { formatCurrency } from '@/lib/utils'
import {
  ArrowRightLeft, Heart, BarChart3, TrendingUp, Calendar,
  Coffee, PartyPopper, CalendarDays, Sparkles, RefreshCw
} from 'lucide-react'

interface StatsData {
  gifts: {
    totalByMe: number
    totalByHer: number
    categories: Record<string, number>
    count: number
  }
  aa: {
    pendingCount: number
    settledCount: number
    categories: Record<string, number>
    pendingBalance: number
  }
  analytics: {
    monthlyTrends: Record<string, number>
    dailyTotals: Record<string, number>
    hourlyDistribution: number[]
    categoryUserSplit: Record<string, { me: number, her: number }>
    balanceHistory: { date: string, balance: number }[]
    timeDistribution: {
      workday: number
      weekend: number
    }
  }
}

type StatsTab = 'aa' | 'gifts' | 'trends'

export default function ClientStatsPage({ fallbackData }: { fallbackData?: StatsData }) {
  const { identity, partnerName } = useIdentity()
  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const { data: stats, isLoading } = useSWR<StatsData>('/api/stats', fetcher, {
    fallbackData,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 15000
  })

  const [tab, setTab] = useState<StatsTab>('trends')
  const [range, setRange] = useState<'7' | '30' | '90' | 'all'>('30')

  const adjustedBalanceHistory = useMemo(() => {
    if (!stats?.analytics?.balanceHistory) return []
    if (identity === 'me') return stats.analytics.balanceHistory
    return stats.analytics.balanceHistory.map(h => ({ ...h, balance: -h.balance }))
  }, [stats?.analytics?.balanceHistory, identity])

  if (isLoading) return <StatsSkeleton />
  if (!stats) return null

  const { gifts, aa, analytics } = stats

  const balance = identity === 'me' ? aa.pendingBalance : -aa.pendingBalance
  const iOwe = balance < 0 ? Math.abs(balance) : 0
  const theyOweMe = balance > 0 ? balance : 0

  const sortedAACats = Object.entries(aa.categories).sort((a, b) => b[1] - a[1])
  const maxAAVal = sortedAACats.length > 0 ? sortedAACats[0][1] : 0

  const sortedGiftCats = Object.entries(gifts.categories).sort((a, b) => b[1] - a[1])
  const maxGiftVal = sortedGiftCats.length > 0 ? sortedGiftCats[0][1] : 0

  const trendEntries = Object.entries(analytics.monthlyTrends)
  const maxTrendVal = trendEntries.length > 0 ? Math.max(...trendEntries.map(e => e[1])) : 0

  return (
    <div className="fade-in" style={{ maxWidth: '100%', paddingBottom: '100px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BarChart3 size={18} color="var(--accent)" />
        <h2 style={{ fontSize: '18px', fontWeight: '800' }}>数据分析</h2>
      </div>

      <div className="glass" style={{
        display: 'flex', marginBottom: '24px',
        padding: '4px', borderRadius: '14px',
        border: '1px solid var(--border)'
      }}>
        {[
          { value: 'trends', label: '趋势', icon: <TrendingUp size={14} /> },
          { value: 'aa', label: '账单', icon: <ArrowRightLeft size={14} /> },
          { value: 'gifts', label: '礼物', icon: <Heart size={14} /> },
        ].map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value as StatsTab)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: tab === t.value ? 'var(--accent)' : 'transparent',
              color: tab === t.value ? '#fff' : 'var(--text-muted)',
              boxShadow: tab === t.value ? '0 4px 15px rgba(232,149,109,0.3)' : 'none'
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'trends' && (
        <div className="fade-in">
          {/* AI Insights Card */}
          <AIInsightsCard stats={stats} identity={identity || ''} partnerName={partnerName || ''} />

          {/* New V7 Charts - Refined (Moved up) */}
          <RangeSelector range={range} setRange={setRange} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px' }}>
            <DailyTrendChart dailyTotals={analytics.dailyTotals} range={range} />
            <BalanceTrendChart data={adjustedBalanceHistory} partnerName={partnerName || ''} range={range} />
          </div>

          {/* Monthly Trend Chart */}
          <div className="premium-card" style={{ padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Calendar size={18} color="var(--accent)" />
              <h3 style={{ fontSize: '15px', fontWeight: '800' }}>月度消费趋势</h3>
            </div>

            {trendEntries.length > 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '12px',
                height: '180px',
                padding: '10px 0',
                overflowX: 'auto',
                justifyContent: trendEntries.length === 1 ? 'center' : 'flex-start'
              }}>
                {trendEntries.map(([month, amount]) => (
                  <div key={month} style={{
                    flex: trendEntries.length === 1 ? '0 0 80px' : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '40px',
                    height: '100%'
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      {amount > 1000 ? (amount / 1000).toFixed(1) + 'k' : amount.toFixed(0)}
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%', padding: '0 4px' }}>
                      <div style={{
                        width: '100%', borderRadius: '4px 4px 1px 1px',
                        background: 'linear-gradient(to top, var(--accent), var(--accent-soft))',
                        height: `${(amount / (maxTrendVal || 1)) * 100}%`,
                        transition: 'height 1s cubic-bezier(0.16, 1, 0.3, 1)',
                        minHeight: '2px'
                      }} />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', whiteSpace: 'nowrap' }}>
                      {month.split('-')[1]}月
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>暂无月度数据</p>
            )}
          </div>

          {/* Daily Heatmap */}
          <HeatmapChart dailyTotals={analytics.dailyTotals} />

          {/* 
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <MetricCard title="单笔均价" value={formatCurrency(Object.values(analytics.dailyTotals).reduce((a, b) => a + b, 0) / (Object.values(analytics.dailyTotals).length || 1))} icon={<TrendingUp size={14} />} />
            <MetricCard title="支出密度" value={`${(Object.values(analytics.dailyTotals).length / (range === 'all' ? 180 : parseInt(range))).toFixed(1)} 条/日`} icon={<Calendar size={14} />} />
          </div>
          */}
        </div>
      )}

      {tab === 'aa' && (
        <div className="fade-in">
          <div className="premium-card" style={{
            padding: '28px 24px', marginBottom: '20px', textAlign: 'center',
            background: iOwe > 0 ? 'rgba(235,87,87,0.02)' : (theyOweMe > 0 ? 'rgba(111,207,151,0.02)' : 'var(--bg-card)')
          }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '600' }}>
              {iOwe > 0 ? `当前欠${partnerName}` : (theyOweMe > 0 ? `${partnerName}欠我` : '账目已结清')}
            </p>
            <p style={{
              fontSize: '44px', fontWeight: '900', letterSpacing: '-2px',
              color: iOwe > 0 ? 'var(--red)' : (theyOweMe > 0 ? 'var(--green)' : 'var(--text-primary)')
            }}>
              {formatCurrency(iOwe || theyOweMe || 0)}
            </p>
          </div>

          <div className="premium-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <BarChart3 size={18} color="var(--accent)" />
              <h3 style={{ fontSize: '15px', fontWeight: '800' }}>消费分类汇总</h3>
            </div>

            {sortedAACats.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {sortedAACats.map(([name, amount]) => (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{name}</span>
                      <span style={{ fontSize: '13px', fontWeight: '700' }}>{formatCurrency(amount)}</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '100px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: 'var(--accent)',
                        width: `${(amount / maxAAVal) * 100}%`,
                        transition: 'width 1s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>暂无支出记录</p>
            )}
          </div>
        </div>
      )}

      {tab === 'gifts' && (
        <div className="fade-in">
          <div className="premium-card" style={{ padding: '28px 24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center', marginBottom: '28px' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>我送出的</p>
                <p style={{ fontSize: '26px', fontWeight: '900', color: 'var(--accent)' }}>{formatCurrency(identity === 'me' ? gifts.totalByMe : gifts.totalByHer)}</p>
              </div>
              <div style={{ width: '1px', background: 'var(--border)', height: '50px' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>{partnerName}送的</p>
                <p style={{ fontSize: '26px', fontWeight: '900', color: 'var(--blue)' }}>{formatCurrency(identity === 'me' ? gifts.totalByHer : gifts.totalByMe)}</p>
              </div>
            </div>
          </div>

          <div className="premium-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Heart size={18} color="var(--blue)" />
              <h3 style={{ fontSize: '15px', fontWeight: '800' }}>礼物类型分布</h3>
            </div>
            {sortedGiftCats.map(([name, amount]) => (
              <div key={name} style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{name}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{formatCurrency(amount)}</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '100px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: 'var(--blue)',
                    width: `${(amount / maxGiftVal) * 100}%`,
                    transition: 'width 1s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


function AIInsightsCard({ stats, identity, partnerName }: { stats: StatsData, identity: string, partnerName: string }) {
  const [insight, setInsight] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(0)

  useEffect(() => {
    const cached = localStorage.getItem('werecord_ai_insight')
    if (cached) {
      const { content, timestamp } = JSON.parse(cached)
      // Cache for 24 hours
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        setInsight(content)
        setLastUpdated(timestamp)
      }
    }
  }, [])

  const fetchInsight = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats, identity, partnerName })
      })
      const data = await res.json()
      if (data.insight) {
        setInsight(data.insight)
        const timestamp = Date.now()
        setLastUpdated(timestamp)
        localStorage.setItem('werecord_ai_insight', JSON.stringify({
          content: data.insight,
          timestamp
        }))
      }
    } catch (e) {
      console.error('AI Insight fetch failed', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="premium-card" style={{
      padding: '24px', marginBottom: '24px',
      background: 'linear-gradient(135deg, rgba(232,149,109,0.1), rgba(125,184,247,0.1))',
      border: '1px solid rgba(232,149,109,0.2)',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'var(--accent)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Sparkles size={16} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--accent)' }}>AI 生活洞察</span>
        </div>

        <button
          onClick={fetchInsight}
          disabled={loading}
          className="btn-ghost"
          style={{
            fontSize: '11px', color: 'var(--accent)', fontWeight: '700',
            padding: '4px 10px', borderRadius: '100px', border: '1px solid var(--accent)',
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'transparent'
          }}
        >
          {loading ? <RefreshCw size={12} className="spin" /> : <RefreshCw size={12} />}
          {insight ? '重新生成' : '开始洞察'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="shimmer" style={{ height: '16px', borderRadius: '4px', width: '90%' }} />
          <div className="shimmer" style={{ height: '16px', borderRadius: '4px', width: '70%' }} />
        </div>
      ) : insight ? (
        <div className="fade-in">
          <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-primary)', fontWeight: '500' }}>
            {insight}
          </p>
          {lastUpdated > 0 && (
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '12px' }}>
              更新于: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div style={{ padding: '10px 0', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            点击按钮，让 AI 基于你们的消费数据提供生活建议...
          </p>
        </div>
      )}
    </div>
  )
}

function HeatmapChart({ dailyTotals }: { dailyTotals: Record<string, number> }) {
  // Generate last 90 days
  const days = []
  const today = new Date()
  for (let i = 89; i >= 0; i--) {
    const d = new Date()
    d.setDate(today.getDate() - i)
    const key = d.toISOString().split('T')[0]
    days.push({ key, amount: dailyTotals[key] || 0 })
  }

  const max = Math.max(...Object.values(dailyTotals), 1)

  return (
    <div className="premium-card" style={{ padding: '24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <CalendarDays size={18} color="var(--blue)" />
        <h3 style={{ fontSize: '15px', fontWeight: '800' }}>消费足迹</h3>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {days.map(day => {
          const intensity = day.amount === 0 ? 0 : Math.max(0.1, (day.amount / max))
          return (
            <div
              key={day.key}
              title={`${day.key}: ${day.amount}元`}
              style={{
                width: '10px', height: '10px', borderRadius: '2px',
                background: day.amount === 0 ? 'var(--bg-secondary)' : `rgba(232, 149, 109, ${intensity + 0.2})`,
                transition: 'all 0.3s ease'
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>
        <span>90天前</span>
        <span>今天</span>
      </div>
    </div>
  )
}


function MetricCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="premium-card" style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px' }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--accent)' }}>{value}</div>
    </div>
  )
}

function RangeSelector({ range, setRange }: { range: string, setRange: (r: any) => void }) {
  const options = [
    { label: '7天', value: '7' },
    { label: '30天', value: '30' },
    { label: '90天', value: '90' },
    { label: '全部', value: 'all' },
  ]
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', padding: '2px 0' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setRange(opt.value)}
          style={{
            padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--border)',
            fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
            background: range === opt.value ? 'var(--accent)' : 'var(--bg-card)',
            color: range === opt.value ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.3s ease'
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function DailyTrendChart({ dailyTotals, range }: { dailyTotals: Record<string, number>, range: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const daysCount = range === 'all' ? 180 : parseInt(range)
  const data = useMemo(() => {
    const res = []
    const today = new Date()
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(today.getDate() - i)
      const key = d.toISOString().split('T')[0]
      res.push({ key, amount: dailyTotals[key] || 0 })
    }
    return res
  }, [dailyTotals, daysCount])

  const max = useMemo(() => Math.max(...data.map(d => d.amount), 100), [data])
  const lastIndex = data.length - 1
  const selected = hoveredIndex !== null ? data[hoveredIndex] : data[lastIndex]

  return (
    <div className="premium-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarDays size={18} color="var(--blue)" />
          <h3 style={{ fontSize: '15px', fontWeight: '800' }}>每日支出波动</h3>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>{formatCurrency(selected.amount)}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{selected.key === data[lastIndex].key ? '今日' : selected.key}</div>
        </div>
      </div>
      {data.every(d => d.amount === 0) ? (
        <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          暂无数据
        </div>
      ) : (
        <div
          style={{ height: '120px', display: 'flex', alignItems: 'flex-end', gap: daysCount > 30 ? '1px' : '3px' }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {data.map((d, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              style={{
                flex: 1,
                background: hoveredIndex === i ? 'var(--accent)' : 'var(--blue)',
                height: `${(d.amount / max) * 100}%`,
                borderRadius: '2px',
                opacity: (hoveredIndex === i || (hoveredIndex === null && i === lastIndex)) ? 1 : 0.4,
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>
        <span>{range === 'all' ? '180天' : `${daysCount}天前`}</span>
        <span>今天</span>
      </div>
    </div>
  )
}

function BalanceTrendChart({ data, partnerName, range }: { data: { date: string, balance: number }[], partnerName: string, range: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const daysCount = range === 'all' ? 999 : parseInt(range)
  const { filteredData, max } = useMemo(() => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysCount)
    const cutoffStr = cutoffDate.toISOString().split('T')[0]
    const fd = range === 'all' ? data : data.filter(d => d.date >= cutoffStr)
    const m = Math.max(...fd.map(d => Math.abs(d.balance)), 10)
    return { filteredData: fd, max: m }
  }, [data, daysCount, range])

  const safeData = filteredData.length > 0 ? filteredData : [{ date: new Date().toISOString().split('T')[0], balance: 0 }]
  const selected = hoveredIndex !== null ? safeData[hoveredIndex] : safeData[safeData.length - 1]

  return (
    <div className="premium-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} color="var(--red)" />
          <h3 style={{ fontSize: '15px', fontWeight: '800' }}>债务余额轨迹</h3>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '900',
            color: selected.balance > 0 ? 'var(--green)' : (selected.balance < 0 ? 'var(--red)' : 'var(--text-primary)')
          }}>
            {formatCurrency(Math.abs(selected.balance))}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {selected.balance > 0 ? 'Ta欠我' : (selected.balance < 0 ? '我欠Ta' : '已结清')} ({selected.date})
          </div>
        </div>
      </div>
      {safeData.every(d => d.balance === 0) ? (
        <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          暂无数据
        </div>
      ) : (
        <div
          style={{
            height: '120px',
            position: 'relative',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: safeData.length === 1 ? 'center' : 'flex-start'
          }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, height: '1px', background: 'var(--border-strong)', opacity: 0.5 }} />
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: safeData.length > 30 ? '1px' : '4px',
            height: '100%',
            width: safeData.length === 1 ? 'auto' : '100%'
          }}>
            {safeData.map((d, i) => (
              <div
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                style={{
                  flex: safeData.length === 1 ? '0 0 40px' : 1,
                  background: d.balance > 0 ? 'var(--green)' : 'var(--red)',
                  height: `${(Math.abs(d.balance) / max) * 50}%`,
                  alignSelf: d.balance > 0 ? 'flex-end' : 'flex-start',
                  marginBottom: d.balance > 0 ? '60px' : '0',
                  marginTop: d.balance < 0 ? '60px' : '0',
                  borderRadius: '1px',
                  opacity: (hoveredIndex === i || (hoveredIndex === null && i === safeData.length - 1)) ? 1 : 0.4,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '9px', color: 'var(--text-muted)' }}>
        <span>{range === 'all' ? '全部历史' : `${range}天内`}</span>
        <span style={{ color: 'var(--text-secondary)' }}>0 点线 (平衡)</span>
        <span>最新状态</span>
      </div>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="shimmer" style={{ width: '120px', height: '28px', borderRadius: '4px', marginBottom: '24px' }} />
      <div className="glass" style={{ height: '50px', borderRadius: '14px', marginBottom: '24px' }} />
      <div className="premium-card shimmer" style={{ height: '180px', marginBottom: '20px' }} />
      <div className="premium-card" style={{ padding: '24px' }}>
        <div className="shimmer" style={{ width: '100px', height: '20px', marginBottom: '24px' }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ marginBottom: '20px' }}>
            <div className="shimmer" style={{ width: '100%', height: '12px', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
