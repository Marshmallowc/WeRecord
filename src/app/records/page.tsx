'use client'

import SmartTitle from '@/components/SmartTitle'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useIdentity } from '@/context/IdentityContext'
import { formatCurrency, formatRelativeDate } from '@/lib/utils'
import {
  Gift, HandCoins, ChevronDown, ChevronUp, Check, Trash2,
  Tag, Calendar, User, Search, RefreshCw, Activity, Edit3,
  SlidersHorizontal
} from 'lucide-react'
import { FeedSkeleton } from '@/components/RecordSkeleton'
import { EditModal } from '@/components/EditModal'
import { PaymentModal } from '@/components/PaymentModal'
import { BatchPaymentModal } from '@/components/BatchPaymentModal'
import useSWR from 'swr'
import useSWRInfinite from 'swr/infinite'
import { Virtuoso } from 'react-virtuoso'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const fetcher = (url: string) => fetch(url).then(res => res.json())

interface AAItem {
  id: string
  name: string
  amount: number
  category: string | null
}

interface RecordItem {
  id: string
  record_type: 'gift' | 'aa'
  created_at: string
  date: string
  source_text: string
  category?: string | null
  from_user?: string
  to_user?: string
  title?: string
  amount?: number
  description?: string
  payer?: string
  status?: 'pending' | 'settled'
  total_amount?: number
  my_share?: number
  note?: string
  aa_items?: AAItem[]
  image_urls?: string[]
  is_uploading?: boolean
}

export default function RecordsHistoryPage() {
  const { identity, partnerName, avatarUrl, partnerAvatarUrl, partnerAlipayCode, pendingUploads } = useIdentity()
  const [hasMounted, setHasMounted] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null)
  const [paymentRecord, setPaymentRecord] = useState<RecordItem | null>(null)
  const [isBatchPaymentOpen, setIsBatchPaymentOpen] = useState(false)

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // SWR for Records
  const getKey = (pageIndex: number, previousPageData: any) => {
    if (previousPageData && !previousPageData.hasMore) return null // reached the end
    return `/api/records?page=${pageIndex + 1}&limit=20&search=${search}&type=${filterType}&category=${filterCategory}`
  }

  const { data: recordsData, error: recordsError, size, setSize, isLoading: isLoadingRecords, mutate: mutateRecords, isValidating } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 15000,
    }
  )

  // SWR for Categories
  const { data: catData, error: catError } = useSWR('/api/categories', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60000
  })
  
  const categories = catData?.data ?? []
  const records = recordsData ? recordsData.flatMap(page => page.data || []) : []

  // Combine uploads in memory with database items
  const displayRecords = [...pendingUploads, ...records].filter(r => {
    if (filterType && r.record_type !== filterType) return false
    return true
  })

  // SWR for Pending AA Bills
  const { data: pendingData, mutate: mutatePending } = useSWR('/api/records/pending', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 15000
  })
  const pendingRecords = pendingData?.data ?? []

  // Net Balance Settlement Logic
  const { iOweRecords, theyOweRecords, totalIOwe, totalTheyOwe, netOwedByMe } = useMemo(() => {
    if (!identity) {
      return {
        iOweRecords: [],
        theyOweRecords: [],
        totalIOwe: 0,
        totalTheyOwe: 0,
        netOwedByMe: 0
      }
    }

    const iOwe: (RecordItem & { displayAmount: number })[] = []
    const theyOwe: (RecordItem & { displayAmount: number })[] = []
    let tIOwe = 0
    let tTheyOwe = 0

    const localPending = pendingUploads.filter(r => r.record_type === 'aa')
    const allPending = [...pendingRecords, ...localPending]

    allPending.forEach(r => {
      if (r.record_type !== 'aa' || r.status === 'settled' || r.is_uploading) return

      const isMePayer = r.payer === identity
      const effectiveMyShare = identity === 'me' ? (r.my_share || 0) : ((r.total_amount || 0) - (r.my_share || 0))
      const effectiveHerShare = (r.total_amount || 0) - effectiveMyShare

      if (!isMePayer && effectiveMyShare > 0) {
        iOwe.push({ ...r, displayAmount: effectiveMyShare })
        tIOwe += effectiveMyShare
      } else if (isMePayer && effectiveHerShare > 0) {
        theyOwe.push({ ...r, displayAmount: effectiveHerShare })
        tTheyOwe += effectiveHerShare
      }
    })

    return {
      iOweRecords: iOwe,
      theyOweRecords: theyOwe,
      totalIOwe: tIOwe,
      totalTheyOwe: tTheyOwe,
      netOwedByMe: tIOwe - tTheyOwe
    }
  }, [pendingRecords, pendingUploads, identity])

  const hasUnsettledBills = iOweRecords.length > 0 || theyOweRecords.length > 0
  const isNetworkError = !!recordsError || !!catError

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Listen for header capsule settlement triggers
  useEffect(() => {
    const handleOpenSettle = () => {
      setIsBatchPaymentOpen(true)
    }
    window.addEventListener('open-batch-settle', handleOpenSettle)
    return () => {
      window.removeEventListener('open-batch-settle', handleOpenSettle)
    }
  }, [])

  // Debounced Search Trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  async function handleSettle(id: string, record?: RecordItem) {
    mutateRecords((current: any) => {
      if (!current) return current
      return current.map((page: any) => ({
        ...page,
        data: page.data?.map((r: any) => r.id === id ? { ...r, status: 'settled' } : r)
      }))
    }, false)

    showToast('已完成结清')

    try {
      await fetch('/api/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: 'aa', status: 'settled' }),
      })

      if (record) {
        const isMe = identity === 'me'
        const targetIdentity = isMe ? 'her' : 'me'
        const amount = identity === 'me' ? (record.my_share || 0) : ((record.total_amount || 0) - (record.my_share || 0))
        const billName = record.aa_items?.map(i => i.name).join('、') || '一笔账单'

        fetch('/api/push/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetIdentity,
            title: '✅ 账单已结清',
            body: `Ta 已经支付了「${billName}」的 ${amount}元，记得查收哦~`,
            url: '/'
          })
        }).catch(err => console.error('Failed to notify partner', err))
      }

      mutateRecords()
      mutatePending()
    } catch (err) {
      showToast('更新失败', false)
      mutateRecords()
      mutatePending()
    }
  }

  async function handleBatchSettle(ids: string[]) {
    mutateRecords((current: any) => {
      if (!current) return current
      return current.map((page: any) => ({
        ...page,
        data: page.data?.map((r: any) => ids.includes(r.id) ? { ...r, status: 'settled' } : r)
      }))
    }, false)

    showToast('正在处理批量结清...')

    try {
      await fetch('/api/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, type: 'aa', status: 'settled' }),
      })

      const count = ids.length
      const isMe = identity === 'me'
      const targetIdentity = isMe ? 'her' : 'me'
      const netPay = Math.max(0, netOwedByMe)

      fetch('/api/push/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetIdentity,
          title: '💰 账单已成功平账',
          body: `Ta 一次性平账了 ${count} 笔账单 (抵扣后净支付 ${netPay} 元)，快去看看吧！`,
          url: '/'
        })
      }).catch(err => console.error('Failed to notify partner', err))

      showToast('全部结清成功')
      mutateRecords()
      mutatePending()
    } catch (err) {
      showToast('批量更新失败', false)
      mutateRecords()
      mutatePending()
    }
  }

  async function handleNudge(record: RecordItem) {
    const isMe = identity === 'me'
    const targetIdentity = isMe ? 'her' : 'me'
    const name = record.aa_items?.map(i => i.name).join('、') || '一笔账单'
    const amount = targetIdentity === 'her'
      ? (record.total_amount! - (record.my_share || 0))
      : (record.my_share || 0)

    try {
      showToast('正在向 Ta 发送提醒...')
      const res = await fetch('/api/push/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetIdentity,
          title: '💸 记账提醒',
          body: `嘿~ 你的亲亲提醒你有一笔 [${name}] 的账单待结清 (${amount}元) 哦`,
          url: '/'
        })
      })
      const data = await res.json()
      if (data.success && data.count > 0) {
        showToast('已成功通过手机通知提醒 Ta')
      } else {
        showToast('Ta 的手机通知未开启或订阅过期', false)
      }
    } catch (e) {
      showToast('发送失败', false)
    }
  }

  async function handleDelete(id: string, type: string) {
    mutateRecords((current: any) => {
      if (!current) return current
      return current.map((page: any) => ({
        ...page,
        data: page.data?.filter((r: any) => r.id !== id)
      }))
    }, false)

    showToast('已删除')

    try {
      await fetch(`/api/records?id=${id}&type=${type}`, { method: 'DELETE' })
      mutateRecords()
      mutatePending()
    } catch (err) {
      showToast('删除失败', false)
      mutateRecords()
      mutatePending()
    }
  }

  return (
    <div style={{ maxWidth: '100%', paddingBottom: '80px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '0', right: '0', margin: '0 auto',
          width: 'max-content', maxWidth: '90%',
          padding: '10px 24px', borderRadius: '100px', fontSize: '13px', fontWeight: '600',
          background: toast.ok ? 'var(--green)' : 'var(--red)', color: '#fff',
          zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {toast.msg}
        </div>
      )}


      {/* Filters Bar */}
      <div style={{ marginBottom: '16px' }}>
        {/* Search Input and Filter Button Row */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: showFilters ? '12px' : '0' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              placeholder="搜索记录明细或备注..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ 
                paddingLeft: '44px', 
                paddingRight: '16px',
                height: '46px', 
                fontSize: '14px',
                borderRadius: '23px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showFilters || filterType || filterCategory ? 'var(--accent-bg)' : 'var(--bg-secondary)',
              border: `1px solid ${showFilters || filterType || filterCategory ? 'var(--accent)' : 'var(--border)'}`,
              color: showFilters || filterType || filterCategory ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              flexShrink: 0
            }}
            title="筛选条件"
          >
            <SlidersHorizontal size={18} />
            {(filterType || filterCategory) && (
              <span style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent)',
                border: '2px solid var(--bg-primary)'
              }} />
            )}
          </button>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div 
            className="premium-card fade-in" 
            style={{ 
              padding: '14px 16px', 
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '4px'
            }}
          >
            {/* Type Filter Row */}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                账目类型
              </div>
              <div 
                className="no-scrollbar" 
                style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  overflowX: 'auto', 
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: '4px'
                }}
              >
                {[
                  { value: '', label: '全部类型' },
                  { value: 'aa', label: 'AA支出' },
                  { value: 'gift', label: '节日礼物' }
                ].map(t => {
                  const active = filterType === t.value
                  return (
                    <button
                      key={t.value}
                      onClick={() => setFilterType(t.value)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '100px',
                        fontSize: '12px',
                        fontWeight: active ? '700' : '500',
                        background: active ? 'var(--accent)' : 'rgba(255, 255, 255, 0.03)',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Category Filter Row */}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                消费分类
              </div>
              <div 
                className="no-scrollbar" 
                style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  overflowX: 'auto', 
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: '4px'
                }}
              >
                <button
                  onClick={() => setFilterCategory('')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '100px',
                    fontSize: '12px',
                    fontWeight: filterCategory === '' ? '700' : '500',
                    background: filterCategory === '' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.03)',
                    color: filterCategory === '' ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${filterCategory === '' ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  全部分类
                </button>
                {categories.map((c: any) => {
                  const active = filterCategory === c.name
                  return (
                    <button
                      key={c.name}
                      onClick={() => setFilterCategory(c.name)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '100px',
                        fontSize: '12px',
                        fontWeight: active ? '700' : '500',
                        background: active ? 'var(--accent)' : 'rgba(255, 255, 255, 0.03)',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Feed Container */}
      <div style={{ height: showFilters ? 'calc(100vh - 310px)' : 'calc(100vh - 180px)', minHeight: '350px', transition: 'height 0.2s ease' }}>
        {isLoadingRecords && size === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <FeedSkeleton /><FeedSkeleton /><FeedSkeleton />
          </div>
        ) : displayRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Activity size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p style={{ fontSize: '14px' }}>暂无记录。让 AI 助手帮我们记一笔吧！</p>
          </div>
        ) : (
          <Virtuoso
            style={{ height: '100%', width: '100%' }}
            data={displayRecords}
            endReached={() => {
              if (!isValidating && recordsData && recordsData[recordsData.length - 1]?.hasMore) {
                setSize(size + 1)
              }
            }}
            itemContent={(index, item) => (
              <div style={{ paddingBottom: '16px' }}>
                <RecordCard
                  record={item}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onSettle={() => handleSettle(item.id, item)}
                  onNudge={handleNudge}
                  onEdit={() => setEditingRecord(item)}
                  partnerName={partnerName}
                  identity={identity}
                  avatarUrl={avatarUrl}
                  partnerAvatarUrl={partnerAvatarUrl}
                />
              </div>
            )}
            components={{
              Footer: () => {
                if (recordsData && recordsData[recordsData.length - 1]?.hasMore) {
                  return (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                      <div className="spinner" style={{ width: '20px', height: '20px' }} />
                    </div>
                  )
                }
                return (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    已经到底啦
                  </div>
                )
              }
            }}
          />
        )}
      </div>

      {/* Modals Container */}
      {editingRecord && (
        <EditModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={() => {
            mutateRecords()
            mutatePending()
          }}
          onDelete={handleDelete}
          identity={identity || 'me'}
          partnerName={partnerName}
        />
      )}

      {paymentRecord && (
        <PaymentModal
          isOpen={!!paymentRecord}
          amount={
            identity === 'me'
              ? (paymentRecord.my_share || 0)
              : ((paymentRecord.total_amount || 0) - (paymentRecord.my_share || 0))
          }
          billName={paymentRecord.aa_items?.map(i => i.name).join('、') || '一笔账单'}
          partnerName={partnerName}
          alipayCode={partnerAlipayCode || ''}
          onClose={() => setPaymentRecord(null)}
          onConfirm={() => {
            handleSettle(paymentRecord.id, paymentRecord)
            setPaymentRecord(null)
          }}
        />
      )}

      {isBatchPaymentOpen && (
        <BatchPaymentModal
          isOpen={isBatchPaymentOpen}
          iOweRecords={iOweRecords}
          theyOweRecords={theyOweRecords}
          netAmount={netOwedByMe}
          partnerName={partnerName}
          alipayCode={partnerAlipayCode}
          onConfirm={handleBatchSettle}
          onClose={() => setIsBatchPaymentOpen(false)}
        />
      )}
    </div>
  )
}

function RecordCard({ record, expanded, onToggle, onSettle, onNudge, onEdit, partnerName, identity, avatarUrl, partnerAvatarUrl }: any) {
  const isGift = record.record_type === 'gift'
  const isMePayerTarget = isGift ? record.from_user === identity : record.payer === identity

  // Calculate personal share relative to current identity
  const effectiveMyShare = identity === 'me' ? (record.my_share || 0) : ((record.total_amount || 0) - (record.my_share || 0))

  // Display Amount logic:
  // If I am the payer, I care about how much the OTHER person owes me (Total - MyShare)
  // If I am NOT the payer, I care about how much I owe (MyShare)
  const displayAmount = isGift
    ? record.amount
    : (!identity ? 0 : (isMePayerTarget ? ((record.total_amount || 0) - effectiveMyShare) : effectiveMyShare))

  let displayCategory = record.category
  if (!displayCategory && record.aa_items && record.aa_items.length > 0) {
    const categories = Array.from(new Set(record.aa_items.map((i: any) => i.category).filter(Boolean)))
    if (categories.length > 0) {
      displayCategory = categories.join('、')
    }
  }
  displayCategory = displayCategory || '未分类'

  return (
    <div className="premium-card scale-in" style={{
      overflow: 'hidden', padding: 0,
      borderLeft: `5px solid ${isGift ? 'var(--accent)' : (isMePayerTarget ? 'var(--blue)' : 'var(--green)')}`,
      opacity: record.is_uploading ? 0.6 : 1, 
      pointerEvents: record.is_uploading ? 'none' : 'auto', 
    }}>
      <div style={{ padding: '16px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                background: isGift ? 'var(--accent-bg)' : (isMePayerTarget ? 'var(--blue-bg)' : 'var(--green-bg)'),
                color: isGift ? 'var(--accent)' : (isMePayerTarget ? 'var(--blue)' : 'var(--green)')
              }}>
                {isGift ? '礼物' : ((record.my_share === 0 || record.my_share === record.total_amount) ? '代付' : 'AA')}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {record.date}
              </span>
            </div>
            <SmartTitle
              type={isGift ? 'gift' : 'aa'}
              title={isGift ? record.title : ''}
              items={record.aa_items}
              note={record.note}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border)', flexShrink: 0 }}>
                {isMePayerTarget ? (
                  avatarUrl ? <img src={avatarUrl} alt="Me" style={{ width: '100%', height: '100%' }} /> : <User size={12} style={{ padding: '6px' }} />
                ) : (
                  partnerAvatarUrl ? <img src={partnerAvatarUrl} alt="Partner" style={{ width: '100%', height: '100%' }} /> : <User size={12} style={{ padding: '6px' }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {isGift
                  ? (record.from_user === identity ? `我送给${partnerName}` : `${partnerName}送我的`)
                  : (record.payer === identity ? '我已支付' : `${partnerName}已支付`)
                }
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: '900', color: !isGift && record.status === 'settled' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {formatCurrency(displayAmount)}
            </div>
            {!isGift && (
              <>
                <div style={{ fontSize: '10px', color: record.is_uploading ? 'var(--blue)' : (record.status === 'settled' ? 'var(--green)' : 'var(--text-muted)'), fontWeight: '800' }}>
                  {record.is_uploading ? '入库中...' : (record.status === 'settled'
                    ? '已结清'
                    : (isMePayerTarget ? `${partnerName} 待结清` : '我 待结清'))
                  }
                </div>
                {!record.is_uploading && (
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    总计 {formatCurrency(record.total_amount)}
                  </div>
                )}
              </>
            )}
            {isGift && record.is_uploading && (
              <div style={{ fontSize: '10px', color: 'var(--blue)', fontWeight: '800', marginTop: '4px' }}>
                入库中...
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)' }} className="fade-in">
          <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <Tag size={12} /> 分类: <span className="tag">{displayCategory}</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.5' }}>
              "{record.source_text || 'AI 录入明细'}"
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '100px' }}
              onClick={(e) => { e.stopPropagation(); onEdit() }}
            >
              <Edit3 size={14} /> 编辑
            </button>
            {!isGift && record.status === 'pending' && (
              <button
                className="btn-primary"
                style={{
                  flex: 2,
                  height: '44px',
                  background: isMePayerTarget ? 'var(--blue)' : 'var(--green)',
                  boxShadow: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '100px'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMePayerTarget) {
                    onNudge(record);
                  } else {
                    onSettle();
                  }
                }}
              >
                {isMePayerTarget ? (
                  <><RefreshCw size={14} style={{ marginRight: '6px' }} /> 催 Ta 结算</>
                ) : (
                  <><Check size={14} style={{ marginRight: '6px' }} /> 结清账单</>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
