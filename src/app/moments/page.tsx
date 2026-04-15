'use client'

import { useState } from 'react'
import { useIdentity } from '@/context/IdentityContext'
import useSWR from 'swr'
import { Activity, RefreshCw } from 'lucide-react'
import MomentCard from '@/components/MomentCard'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface RecordItem {
  id: string
  record_type: 'gift' | 'aa' | 'insight'
  created_at: string
  date: string
  source_text: string
  content?: string // For AI insights
  insight_type?: string
  category?: string | null
  from_user?: string
  to_user?: string
  title?: string
  amount?: number
  description?: string
  payer?: string
  image_urls?: string[]
  is_uploading?: boolean
  aa_items?: any[]
}

export default function MomentsPage() {
  const { identity, partnerName, avatarUrl, partnerAvatarUrl, pendingUploads } = useIdentity()
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

  const { data: recordsData, error, isLoading, isValidating, mutate } = useSWR(
    '/api/records?limit=100&include_insights=true', // Fetch more for the moments feed
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    }
  )

  async function handleDelete(id: string, type: string) {
    if (!confirm('确定要删除这条动态吗？')) return
    try {
      const res = await fetch(`/api/records?id=${id}&type=${type}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      mutate()
    } catch (err) {
      alert('删除失败，请稍后重试')
    }
  }

  const records = recordsData?.data ?? []
  const displayRecords = [...pendingUploads, ...records]

  // Grouping logic to merge split records from the same input
  const groupedMoments = (() => {
    const groups: any[] = []
    const processedIds = new Set()

    // 1. Sort all records by created_at descending (newest first)
    const sorted = [...displayRecords].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i]
      if (processedIds.has(r.id)) continue

      if (r.record_type === 'insight') {
        groups.push({ type: 'insight', main: r, items: [r] })
        processedIds.add(r.id)
        continue
      }

      // Start a new group for records
      const group: { type: 'records', main: RecordItem, items: RecordItem[] } = {
        type: 'records',
        main: r,
        items: [r]
      }
      processedIds.add(r.id)

      // Look for siblings within 10 seconds that share the same source_text and author
      const rAuthor = r.record_type === 'gift' ? r.from_user : r.payer
      
      for (let j = i + 1; j < sorted.length; j++) {
        const s = sorted[j]
        if (processedIds.has(s.id) || s.record_type === 'insight') continue

        const sAuthor = s.record_type === 'gift' ? s.from_user : s.payer
        const timeDiff = Math.abs(new Date(r.created_at).getTime() - new Date(s.created_at).getTime())

        if (s.source_text === r.source_text && sAuthor === rAuthor && timeDiff < 10000) {
          group.items.push(s)
          processedIds.add(s.id)
        }
      }
      groups.push(group)
    }
    return groups
  })()

  const isNetworkError = !!error

  return (
    <div style={{ maxWidth: '100%', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>动态</h2>
        <button
          onClick={() => mutate()}
          className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', padding: '6px 12px' }}
        >
          <RefreshCw size={14} className={isValidating ? 'spin' : ''} /> 刷新
        </button>
      </div>

      {isLoading && groupedMoments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <Activity size={24} className="spin" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px' }}>加载中...</p>
        </div>
      ) : isNetworkError && groupedMoments.length === 0 ? (
        <div className="premium-card" style={{ padding: '40px 20px', textAlign: 'center', borderColor: 'var(--red)', background: 'var(--red-bg)' }}>
          <p style={{ color: 'var(--red)', fontSize: '14px', fontWeight: '600' }}>网络开小差了，稍后重试</p>
        </div>
      ) : groupedMoments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '14px' }}>还没有任何动态，快去记录一笔吧~</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {groupedMoments.map((moment: any) => (
            <MomentCard 
              key={moment.main.id}
              moment={moment}
              identity={identity!}
              partnerName={partnerName}
              avatarUrl={avatarUrl}
              partnerAvatarUrl={partnerAvatarUrl}
              onDelete={handleDelete}
              onEnlargeImage={(url) => setEnlargedImage(url)}
            />
          ))}
        </div>
      )}

      {/* Fullscreen Image Preview */}
      {enlargedImage && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out'
          }}
          onClick={() => setEnlargedImage(null)}
        >
          <img
            src={enlargedImage}
            alt="Enlarged moment preview"
            style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  )
}
