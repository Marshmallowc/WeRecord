'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useIdentity } from '@/context/IdentityContext'
import { formatCurrency, formatRelativeDate } from '@/lib/utils'
import {
  ArrowUp, Gift, HandCoins, ChevronDown, ChevronUp, Check, Trash2,
  Tag, Calendar, User, Search, Filter, Edit3, X, RefreshCw
} from 'lucide-react'
import { FeedSkeleton } from '@/components/RecordSkeleton'
import { EditModal } from '@/components/EditModal'
import useSWR, { mutate } from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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
}

interface ParsedResult {
  type: 'gift' | 'aa'
  [key: string]: any
}

export default function HomePage() {
  const { identity, partnerName, avatarUrl, partnerAvatarUrl } = useIdentity()
  const [hasMounted, setHasMounted] = useState(false)
  const [text, setText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [preview, setPreview] = useState<{ results: ParsedResult[]; source_text: string } | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null)

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // SWR for Records - Optimized for depth and persistence
  const { data: recordsData, isLoading: isLoadingRecords, isValidating } = useSWR(
    `/api/records?limit=40&search=${search}&type=${filterType}&category=${filterCategory}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false, // Use stale data until a hard refresh happens
      dedupingInterval: 15000,   // Prevent redundant fetches within 15 seconds
    }
  )

  // SWR for Categories - Rarely changes
  const { data: catData } = useSWR('/api/categories', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60000 // 1 minute cache for category list
  })
  const categories = catData?.data ?? []
  const records = recordsData?.data ?? []
  const mountedRef = useRef(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    setHasMounted(true)

    // Web Push Registration
    if ('serviceWorker' in navigator && 'PushManager' in window && identity) {
      navigator.serviceWorker.register('/sw.js').then(async (reg) => {
        console.log('SW Registered');

        let sub = await reg.pushManager.getSubscription();
        if (!sub && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
          try {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
            });
          } catch (e) {
            console.error('Failed to subscribe to push', e);
          }
        }

        if (sub) {
          await fetch('/api/push/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity, subscription: sub })
          });
        }
      });
    }
  }, [identity])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  async function handleSubmit() {
    if (!text.trim() || isParsing) return
    setIsParsing(true)
    setPreview(null)

    try {
      const res = await fetch('/api/ai-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), identity }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // data.result is now an array
      const results = Array.isArray(data.result) ? data.result : [data.result]
      setPreview({ results, source_text: text.trim() })
    } catch (err: any) {
      showToast(err.message || 'AI 解析失败', false)
    } finally {
      setIsParsing(false)
    }
  }

  async function handleSave() {
    if (!preview) return
    setIsSaving(true)
    try {
      const payload = {
        identity,
        items: preview.results.map(r => ({
          type: r.type,
          result: r,
          source_text: preview.source_text
        }))
      }
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      setPreview(null)
      setText('')
      showToast(`成功入住 ${preview.results.length} 条记录`)
      mutate(url => typeof url === 'string' && url.includes('/api/records'))
    } catch {
      showToast('保存失败', false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSettle(id: string) {
    await fetch('/api/records', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'aa', status: 'settled' }),
    })
    mutate(url => typeof url === 'string' && url.includes('/api/records'))
    showToast('已标记结清')
  }

  async function handleNudge(record: RecordItem) {
    const targetIdentity = identity === 'me' ? 'her' : 'me'
    const name = record.aa_items?.map(i => i.name).join('、') || '一笔账单'
    const amount = record.total_amount! - (record.my_share || 0)

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
    await fetch(`/api/records?id=${id}&type=${type}`, { method: 'DELETE' })
    mutate(url => typeof url === 'string' && url.includes('/api/records'))
    showToast('已删除')
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  return (
    <div style={{ maxWidth: '100%', paddingBottom: '80px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          padding: '10px 24px', borderRadius: '100px', fontSize: '13px', fontWeight: '600',
          background: toast.ok ? 'var(--green)' : 'var(--red)', color: '#fff',
          zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          animation: 'scaleIn 0.3s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Hero / Input Section */}
      <div className="premium-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px', fontWeight: '600' }}>
          记录新动态
        </p>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            className="input"
            rows={2}
            value={text}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={`今天买了两个冰淇淋，一共25元\n给${partnerName}买了一件外套，大概399`}
            style={{ paddingRight: '48px', minHeight: '90px' }}
            disabled={isParsing || !!preview}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isParsing || !!preview}
            className="btn-primary"
            style={{
              position: 'absolute', right: '8px', bottom: '8px',
              width: '40px', height: '40px', borderRadius: '12px',
              padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {isParsing ? <div className="spinner" style={{ width: '16px', height: '16px' }} /> : <ArrowUp size={20} />}
          </button>
        </div>
      </div>

      {/* AI Preview */}
      {preview && (
        <div className="premium-card slide-up" style={{
          padding: '20px', marginBottom: '24px',
          border: '2px solid var(--accent)', background: 'var(--accent-bg)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontWeight: '700' }}>AI 识别预览 ({preview.results.length})</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            {preview.results.map((res, idx) => (
              <div key={idx} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div className="tag" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                    {res.type === 'gift' ? <Gift size={12} /> : <HandCoins size={12} />}
                    {res.type === 'gift' ? '礼物' : '支出'}
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{res.category}</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>
                  {res.type === 'gift' ? res.title : (res.items?.map((i: any) => i.name).join('、') || '未命名支出')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <span>
                    {res.type === 'gift'
                      ? (res.from === identity ? '我送出的' : `${partnerName}送出的`)
                      : (res.payer === identity ? '我付款' : `${partnerName}付款`)}
                  </span>
                  <span style={{ color: 'var(--accent)', fontWeight: '700' }}>
                    {formatCurrency(Number(res.type === 'gift' ? res.amount : res.my_share) || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setPreview(null)} style={{ flex: 1 }}>取消</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ flex: 2 }}>
              {isSaving ? '入库中...' : '确认全部入库'}
            </button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            placeholder="搜索记录..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{ paddingLeft: '34px', height: '40px', fontSize: '13px' }}
          />
        </div>
        <select
          className="input"
          style={{ width: '100px', height: '40px', fontSize: '13px' }}
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">全部类型</option>
          <option value="aa">AA支出</option>
          <option value="gift">礼物记录</option>
        </select>
        <select
          className="input"
          style={{ width: '100px', height: '40px', fontSize: '13px' }}
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">全部分类</option>
          {categories.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* Main Feed */}
      <div style={{ minHeight: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>最近动态</h2>
          <button onClick={() => mutate(url => typeof url === 'string' && url.includes('/api/records'))} className="btn-ghost" style={{
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 8px'
          }}>
            <RefreshCw size={12} className={isValidating ? 'spin' : ''} /> 刷新
          </button>
        </div>

        {isLoadingRecords ? (
          <FeedSkeleton />
        ) : records.length === 0 ? (
          <div className="premium-card" style={{ padding: '60px 20px', textAlign: 'center', borderStyle: 'dashed' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>没有找到相关记录</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {records.map((r: RecordItem) => (
              <RecordCard
                key={r.id}
                record={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                onSettle={handleSettle}
                onNudge={handleNudge}
                onEdit={() => setEditingRecord(r)}
                partnerName={partnerName}
                identity={identity}
                avatarUrl={avatarUrl}
                partnerAvatarUrl={partnerAvatarUrl}
              />
            ))}
          </div>
        )}
      </div>

      {editingRecord && (
        <EditModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          identity={identity!}
          partnerName={partnerName}
          onSave={(u) => {
            mutate(url => typeof url === 'string' && url.includes('/api/records'))
            showToast('已更新')
          }}
          onDelete={async (id, type) => {
            await handleDelete(id, type)
            setEditingRecord(null)
          }}
        />
      )}
    </div>
  )
}

function RecordCard({ record, expanded, onToggle, onSettle, onNudge, onEdit, partnerName, identity, avatarUrl, partnerAvatarUrl }: any) {
  const isGift = record.record_type === 'gift'
  const isMePayerTarget = isGift ? record.from_user === identity : record.payer === identity

  // Calculate personal share relative to current identity
  // Database always stores my_share relative to 'me'
  const effectiveMyShare = identity === 'me' ? (record.my_share || 0) : ((record.total_amount || 0) - (record.my_share || 0))

  // Display Amount logic:
  // If I am the payer, I care about how much the OTHER person owes me (Total - MyShare)
  // If I am NOT the payer, I care about how much I owe (MyShare)
  const displayAmount = isGift
    ? record.amount
    : (isMePayerTarget ? ((record.total_amount || 0) - effectiveMyShare) : effectiveMyShare)

  return (
    <div className="premium-card scale-in" style={{
      overflow: 'hidden', padding: 0,
      borderLeft: `5px solid ${isGift ? 'var(--accent)' : (isMePayerTarget ? 'var(--blue)' : 'var(--green)')}`,
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
                {isGift ? 'GIFT' : ((record.my_share === 0 || record.my_share === record.total_amount) ? 'DEBT' : 'AA')}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {record.date}
              </span>
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>
              {isGift ? record.title : record.aa_items?.map((i: any) => i.name).join('、')}
            </h3>
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
                  : (record.payer === identity ? '我付的' : `${partnerName}付的`)
                }
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: '900', color: !isGift && record.status === 'settled' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {formatCurrency(displayAmount)}
            </div>
            {!isGift && (
              <div style={{ fontSize: '10px', color: record.status === 'settled' ? 'var(--green)' : 'var(--text-muted)', fontWeight: '800' }}>
                {record.status === 'settled' ? '已结清' : '待结清'}
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)' }} className="fade-in">
          <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <Tag size={12} /> 分类: <span className="tag">{record.category || '未分类'}</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.5' }}>
              "{record.source_text}"
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
                    onSettle(record.id);
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
