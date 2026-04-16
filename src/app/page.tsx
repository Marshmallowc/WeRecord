'use client'

import SmartTitle from '@/components/SmartTitle'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useIdentity } from '@/context/IdentityContext'
import { formatCurrency, formatRelativeDate, urlBase64ToUint8Array } from '@/lib/utils'
import {
  ArrowUp, Gift, HandCoins, ChevronDown, ChevronUp, Check, Trash2,
  Tag, Calendar, User, Search, Filter, Edit3, X, RefreshCw, Activity, Image as ImageIcon
} from 'lucide-react'
import { FeedSkeleton } from '@/components/RecordSkeleton'
import { EditModal } from '@/components/EditModal'
import { PaymentModal } from '@/components/PaymentModal'
import { BatchPaymentModal } from '@/components/BatchPaymentModal'
import useSWR, { mutate } from 'swr'
import imageCompression from 'browser-image-compression'
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

interface ParsedResult {
  type: 'gift' | 'aa'
  [key: string]: any
}

export default function HomePage() {
  const { identity, partnerName, avatarUrl, partnerAvatarUrl, partnerAlipayCode, pendingUploads, addPendingUpload, removePendingUpload } = useIdentity()
  const [hasMounted, setHasMounted] = useState(false)
  const [text, setText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [preview, setPreview] = useState<{ results: ParsedResult[]; source_text: string } | null>(null)
  const [images, setImages] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null)
  const [paymentRecord, setPaymentRecord] = useState<RecordItem | null>(null)
  const [isBatchPaymentOpen, setIsBatchPaymentOpen] = useState(false)

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // SWR for Records - Optimized for depth and persistence
  const { data: recordsData, error: recordsError, isLoading: isLoadingRecords, isValidating } = useSWR(
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
  const { data: catData, error: catError } = useSWR('/api/categories', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60000 // 1 minute cache for category list
  })
  const categories = catData?.data ?? []
  const records = recordsData?.data ?? []

  // Dual-Track Rendering Synthesis!
  // Prepend our global mock uploading records to the truth from the server.
  const displayRecords = [...pendingUploads, ...records].filter(r => {
    if (filterType && r.record_type !== filterType) return false
    return true
  })

  // Net Balance Settlement Logic
  const { iOweRecords, theyOweRecords, totalIOwe, totalTheyOwe, netOwedByMe } = useMemo(() => {
    const iOwe: (RecordItem & { displayAmount: number })[] = []
    const theyOwe: (RecordItem & { displayAmount: number })[] = []
    let tIOwe = 0
    let tTheyOwe = 0

    displayRecords.forEach(r => {
      if (r.record_type !== 'aa' || r.status === 'settled' || r.is_uploading) return

      const isMePayer = r.payer === identity
      const effectiveMyShare = identity === 'me' ? (r.my_share || 0) : ((r.total_amount || 0) - (r.my_share || 0))
      const effectiveHerShare = (r.total_amount || 0) - effectiveMyShare

      if (!isMePayer && effectiveMyShare > 0) {
        // They paid, I owe my share
        iOwe.push({ ...r, displayAmount: effectiveMyShare })
        tIOwe += effectiveMyShare
      } else if (isMePayer && effectiveHerShare > 0) {
        // I paid, they owe their share
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
  }, [displayRecords, identity])

  const hasUnsettledBills = iOweRecords.length > 0 || theyOweRecords.length > 0

  // Combine errors
  const isNetworkError = !!recordsError || !!catError;

  const mountedRef = useRef(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    setHasMounted(true)

    // Web Push Registration
    if ('serviceWorker' in navigator && 'PushManager' in window && identity) {
      console.log('Push notification support detected. Registering SW...');
      navigator.serviceWorker.register('/sw.js').then(async (reg) => {
        console.log('Service Worker Registered successfully');

        try {
          // IMPORTANT: Wait for the service worker to be active before subscribing
          const readyReg = await navigator.serviceWorker.ready;

          let sub = await readyReg.pushManager.getSubscription();
          if (!sub && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
            console.log('No existing subscription found. Requesting new one...');
            try {
              sub = await readyReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
              });
              console.log('Successfully subscribed to Push Notifications!');
            } catch (e: any) {
              console.error('Failed to subscribe to push通知失败:', e);
              if (e.name === 'NotAllowedError') {
                console.warn('User denied notification permissions.');
              }
            }
          }

          if (sub) {
            console.log('Syncing subscription to Supabase for identity:', identity);

            const subJson = sub.toJSON();
            const subStr = JSON.stringify(subJson);
            const cacheKey = `push_sub_${identity}`;

            if (localStorage.getItem(cacheKey) === subStr) {
              console.log('Subscription already synced (cached locally). Skipping network request.');
            } else {
              // 真正的“静默重试”逻辑（指数退避算法 Exponential Backoff）
              const syncSubscription = async (retryCount = 0) => {
                try {
                  const res = await fetch('/api/push/subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identity, subscription: subJson })
                  });

                  if (res.ok) {
                    console.log('Subscription synced successfully.');
                    localStorage.setItem(cacheKey, subStr);
                  } else {
                    const err = await res.json();
                    throw new Error(err.error || 'Server sync failed');
                  }
                } catch (err: any) {
                  if (retryCount < 3) { // 最大重试 3 次
                    const delayMs = Math.pow(2, retryCount) * 5000; // 分别等待 5秒、10秒、20秒
                    console.warn(`[Push Sync] Network issue, retrying in ${delayMs / 1000}s... (Attempt ${retryCount + 1}/3)`);
                    setTimeout(() => syncSubscription(retryCount + 1), delayMs);
                  } else {
                    // 彻底失败，静默放弃，不下发给用户任何弹窗
                    console.warn('[Push Sync] Failed after 3 retries, deferring to next page load.');
                  }
                }
              };

              syncSubscription();
            }
          }
        } catch (e) {
          console.error('Failed to initialize push subscription:', e);
        }
      }).catch(err => {
        console.error('Service Worker registration failed:', err);
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

    // 1. Snapshot the data for background task
    const snapshotPreview = preview
    const snapshotImages = [...images]
    const currentIdentity = identity

    // Give the local images temporary blob URLs so they can render instantly
    const localBlobUrls = snapshotImages.map(f => URL.createObjectURL(f))

    // 2. Build mock datasets for immediate UI feedback
    const tempPrefix = `temp-${Date.now()}`
    const mockRecords: RecordItem[] = preview.results.map((r, i) => ({
      id: `${tempPrefix}-${i}`,
      record_type: r.type,
      created_at: new Date().toISOString(),
      date: r.date || new Date().toISOString().split('T')[0],
      source_text: preview.source_text,
      category: r.category || '未分类',
      from_user: r.from,
      to_user: r.to,
      title: r.title,
      amount: r.amount,
      payer: r.payer,
      status: 'pending',
      total_amount: r.total,
      my_share: r.my_share,
      aa_items: r.items,
      image_urls: localBlobUrls, // Use local blob URLs immediately for the mock card
      is_uploading: true, // Marker for temporary UI status
    }))

    // 3. Clear input and preview states immediately (Optimistic reset)
    setPreview(null)
    setText('')
    setImages([])

    // 4. Force inject mock records into the global Client State (Pending Uploads Queue)
    mockRecords.forEach(m => addPendingUpload(m))
    showToast('入库中...', true)

      // 5. Fire off the background task asynchronously (no await)
      ; (async () => {
        try {
          let uploadedUrls: string[] = []
          if (snapshotImages.length > 0) {
            for (const file of snapshotImages) {
              const ext = file.name.split('.').pop() || 'jpg'
              const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
              const path = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`

              const options = { maxSizeMB: 0.2, maxWidthOrHeight: 1200, useWebWorker: true }
              const compressedFile = await imageCompression(file, options)

              const { data, error } = await supabase.storage.from('record_images').upload(path, compressedFile)
              if (error) console.error('Upload error', error)
              if (data) uploadedUrls.push(`/${path}`)
            }
          }

          const payload = {
            identity: currentIdentity,
            items: snapshotPreview.results.map(r => ({
              type: r.type,
              result: { ...r, image_urls: uploadedUrls },
              source_text: snapshotPreview.source_text
            }))
          }

          const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!res.ok) throw new Error()

          showToast(`入库成功`)
        } catch {
          showToast('入库失败，请刷新后再试', false)
        } finally {
          // 6. Regardless of success/fail, clean up the global mock list
          mockRecords.forEach(m => removePendingUpload(m.id))
          // And hit the network to sync the true state
          const keyFilter = (url: any) => typeof url === 'string' && url.includes('/api/records')
          mutate(keyFilter)
        }
      })()
  }

  async function handleSettle(id: string, record?: RecordItem) {
    const keyFilter = (url: any) => typeof url === 'string' && url.includes('/api/records')

    // 1. Optimistic UI update
    mutate(keyFilter, (current: any) => {
      if (!current?.data) return current
      return {
        ...current,
        data: current.data.map((r: any) => r.id === id ? { ...r, status: 'settled' } : r)
      }
    }, false)

    showToast('已完成结清')

    try {
      // 2. Network request
      await fetch('/api/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: 'aa', status: 'settled' }),
      })

      // 3. Send Notification to Partner
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

      // 4. Final sync
      mutate(keyFilter)
    } catch (err) {
      showToast('更新失败', false)
      mutate(keyFilter)
    }
  }

  async function handleBatchSettle(ids: string[]) {
    const keyFilter = (url: any) => typeof url === 'string' && url.includes('/api/records')

    // 1. Optimistic UI update
    mutate(keyFilter, (current: any) => {
      if (!current?.data) return current
      return {
        ...current,
        data: current.data.map((r: any) => ids.includes(r.id) ? { ...r, status: 'settled' } : r)
      }
    }, false)

    showToast('正在处理批量结清...')

    try {
      // 2. Network request using the new batch support in PATCH
      await fetch('/api/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, type: 'aa', status: 'settled' }),
      })

      // 3. Send Summary Notification to Partner
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
      // 4. Final sync
      mutate(keyFilter)
    } catch (err) {
      showToast('批量更新失败', false)
      mutate(keyFilter)
    }
  }

  async function handleNudge(record: RecordItem) {
    const isMe = identity === 'me'
    const targetIdentity = isMe ? 'her' : 'me'
    const name = record.aa_items?.map(i => i.name).join('、') || '一笔账单'

    // Logic: amount is what the TARGET user owes
    // If target is 'her' (I am 'me'), she owes total - my_share
    // If target is 'me' (I am 'her'), I owe record.my_share
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
    const keyFilter = (url: any) => typeof url === 'string' && url.includes('/api/records')

    // 1. Optimistic UI update
    mutate(keyFilter, (current: any) => {
      if (!current?.data) return current
      return {
        ...current,
        data: current.data.filter((r: any) => r.id !== id)
      }
    }, false)

    showToast('已删除')

    try {
      // 2. Network request
      await fetch(`/api/records?id=${id}&type=${type}`, { method: 'DELETE' })
      // 3. Final sync
      mutate(keyFilter)
    } catch (err) {
      showToast('删除失败', false)
      mutate(keyFilter)
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    console.log('[DEBUG] handleImageSelect triggered')

    if (!e.target.files) {
      console.warn('[DEBUG] No e.target.files found in event payload')
      showToast('图片读取异常: 没有收到文件流', false)
      return
    }

    console.log('[DEBUG] Files selected count:', e.target.files.length)
    if (e.target.files.length === 0) {
      console.warn('[DEBUG] User canceled or OS returned empty file list')
      return;
    }

    // Defensive copy to break the reference tie to the DOM element
    const newFiles = Array.from(e.target.files)
    console.log('[DEBUG] Files array extracted:', newFiles.map(f => ({
      name: f.name,
      size: Math.round(f.size / 1024) + 'KB',
      type: f.type
    })))

    setImages((prev) => {
      const combined = [...prev, ...newFiles]
      if (combined.length > 9) {
        showToast('每次最多只能附带 9 张图片哦', false)
        console.warn('[DEBUG] Selected too many images, slicing down to 9')
        return combined.slice(0, 9)
      }
      console.log('[DEBUG] State update dispatched. Next images total count:', combined.length)
      return combined
    })

    // Reset input with a delay to completely avoid mobile OS race conditions
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
        console.log('[DEBUG] Input value forcibly reset after 150ms delay')
      }
    }, 150)
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

      {/* Hero / Input Section */}
      <div className="premium-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px', fontWeight: '600' }}>
          记录新动态
        </p>
        <div>
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
            style={{ minHeight: '100px', padding: '16px', fontSize: '15px', lineHeight: '1.6' }}
            disabled={isParsing || !!preview}
          />
        </div>

        {/* Toolbar Below Input */}
        <div style={{ display: 'flex', marginTop: '14px', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 14px', fontSize: '13px', borderRadius: '12px',
                background: 'var(--bg-secondary)', color: 'var(--text-secondary)'
              }}
              disabled={isParsing || !!preview}
            >
              <ImageIcon size={18} strokeWidth={2} />
              {images.length > 0 && <span>{images.length}</span>}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              multiple
              accept="image/*"
              style={{ display: 'none' }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isParsing || !!preview}
            className="btn-primary"
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', gap: '8px',
              opacity: !text.trim() ? 0.5 : 1,
              flexShrink: 0
            }}
          >
            {isParsing ? (
              <div className="spinner" style={{ width: '16px', height: '16px' }} />
            ) : (
              <>
                <span style={{ fontSize: '14px', fontWeight: '700' }}>识别动态</span>
                <ArrowUp size={18} strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>

        {/* Selected Image Previews */}
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            {images.map((file, idx) => (
              <div key={idx} style={{ position: 'relative', width: '60px', height: '60px' }}>
                <img
                  src={URL.createObjectURL(file)}
                  alt="preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                />
                <button
                  disabled={isParsing || !!preview}
                  onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                  style={{
                    position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px',
                    background: 'var(--red)', color: '#fff', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
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
                <SmartTitle
                  type={res.type}
                  title={res.title}
                  items={res.items}
                  note={res.note}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <span>
                    {res.type === 'gift'
                      ? (res.from === identity ? '我送出的' : `${partnerName}送出的`)
                      : (res.payer === identity ? '我已支付' : `${partnerName}已支付`)}
                  </span>
                  <span style={{ color: 'var(--accent)', fontWeight: '700' }}>
                    {formatCurrency(Number(
                      res.type === 'gift'
                        ? res.amount
                        : (res.payer === identity ? ((res.total || 0) - (res.my_share || 0)) : res.my_share)
                    ) || 0)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>最近动态</h2>
            {!hasUnsettledBills ? (
              <span style={{
                fontSize: '11px', color: 'var(--green)', padding: '2px 8px',
                borderRadius: '100px', background: 'var(--green-bg)', fontWeight: '600'
              }}>
                已结清
              </span>
            ) : netOwedByMe > 0 ? (
              <button
                onClick={() => setIsBatchPaymentOpen(true)}
                className="btn-primary"
                style={{
                  fontSize: '11px', padding: '4px 10px', height: 'auto', borderRadius: '100px',
                  background: 'var(--accent)', boxShadow: '0 4px 12px var(--accent-bg)'
                }}
              >
                一键结清 (-{formatCurrency(netOwedByMe)})
              </button>
            ) : netOwedByMe < 0 ? (
              <button
                onClick={() => setIsBatchPaymentOpen(true)}
                className="btn-primary"
                style={{
                  fontSize: '11px', padding: '4px 10px', height: 'auto', borderRadius: '100px',
                  background: 'var(--orange, #f59e0b)', boxShadow: '0 4px 12px var(--orange-bg, #fef3c7)'
                }}
              >
                待核对结清 (+{formatCurrency(Math.abs(netOwedByMe))})
              </button>
            ) : (
              <button
                onClick={() => setIsBatchPaymentOpen(true)}
                className="btn-primary"
                style={{
                  fontSize: '11px', padding: '4px 10px', height: 'auto', borderRadius: '100px',
                  background: 'var(--green)', boxShadow: '0 4px 12px var(--green-bg)'
                }}
              >
                抵消平账
              </button>
            )}
          </div>
          <button onClick={() => mutate(url => typeof url === 'string' && url.includes('/api/records'))} className="btn-ghost" style={{
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 8px'
          }}>
            <RefreshCw size={12} className={isValidating ? 'spin' : ''} /> 刷新
          </button>
        </div>

        {isLoadingRecords && !isNetworkError && displayRecords.length === 0 ? (
          <FeedSkeleton />
        ) : isNetworkError && displayRecords.length === 0 ? (
          <div className="premium-card" style={{ padding: '60px 20px', textAlign: 'center', borderColor: 'var(--red)', background: 'var(--red-bg)' }}>
            <Activity size={32} style={{ margin: '0 auto 16px', color: 'var(--red)', opacity: 0.8 }} />
            <p style={{ color: 'var(--red)', fontSize: '15px', fontWeight: '800', marginBottom: '8px' }}>网络开小差了</p>
            <p style={{ color: 'var(--red)', fontSize: '13px', opacity: 0.8 }}>正在拼命重连获取账单数据...</p>
          </div>
        ) : displayRecords.length === 0 ? (
          <div className="premium-card" style={{ padding: '60px 20px', textAlign: 'center', borderStyle: 'dashed' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>没有找到相关记录</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayRecords.map((r: RecordItem) => (
              <RecordCard
                key={r.id}
                record={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                onSettle={() => setPaymentRecord(r)}
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

      {paymentRecord && (
        <PaymentModal
          isOpen={!!paymentRecord}
          onClose={() => setPaymentRecord(null)}
          amount={identity === 'me' ? (paymentRecord.my_share || 0) : ((paymentRecord.total_amount || 0) - (paymentRecord.my_share || 0))}
          billName={paymentRecord.aa_items?.map(i => i.name).join('、') || '一笔账单'}
          partnerName={partnerName}
          alipayCode={partnerAlipayCode}
          onConfirm={() => handleSettle(paymentRecord.id, paymentRecord)}
        />
      )}

      {isBatchPaymentOpen && (
        <BatchPaymentModal
          isOpen={isBatchPaymentOpen}
          onClose={() => setIsBatchPaymentOpen(false)}
          iOweRecords={iOweRecords}
          theyOweRecords={theyOweRecords}
          netAmount={netOwedByMe}
          partnerName={partnerName}
          alipayCode={partnerAlipayCode}
          onConfirm={handleBatchSettle}
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
      opacity: record.is_uploading ? 0.6 : 1, // Visual indication for uploading state
      pointerEvents: record.is_uploading ? 'none' : 'auto', // Prevent clicks on mock record
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
                  : (record.payer === identity ? '我已付的' : `${partnerName}已付的`)
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
