'use client'

import { useState } from 'react'
import { useIdentity } from '@/context/IdentityContext'
import useSWR from 'swr'
import { Activity, RefreshCw, Trash2 } from 'lucide-react'

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
  const isNetworkError = !!error

  // Helper to format precisely like WeChat moment timeline time
  function formatMomentTime(isoString: string) {
    const d = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays === 1) return `昨天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    if (diffDays < 7) return `${diffDays}天前`

    // Older than a week
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

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

      {isLoading && displayRecords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <Activity size={24} className="spin" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px' }}>加载中...</p>
        </div>
      ) : isNetworkError && displayRecords.length === 0 ? (
        <div className="premium-card" style={{ padding: '40px 20px', textAlign: 'center', borderColor: 'var(--red)', background: 'var(--red-bg)' }}>
          <p style={{ color: 'var(--red)', fontSize: '14px', fontWeight: '600' }}>网络开小差了，稍后重试</p>
        </div>
      ) : displayRecords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '14px' }}>还没有任何动态，快去记录一笔吧~</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {displayRecords.map((record: RecordItem) => {
            if (record.record_type === 'insight') {
              return (
                <div key={record.id} style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '20px 0',
                  borderBottom: '1px solid var(--border)'
                }}>
                  {/* AI Avatar */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      overflow: 'hidden',
                      border: '1px solid var(--border)'
                    }}>
                      <img src="/ai-avatar.svg" alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--indigo)' }}>
                        Mason
                      </div>
                    </div>
                    <div style={{
                      fontSize: '15px',
                      color: 'var(--text-primary)',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      marginBottom: '10px'
                    }}>
                      {record.content}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatMomentTime(record.created_at)} · AI见解
                    </div>
                  </div>
                </div>
              )
            }

            // Determine author of the post based on record type
            const postAuthorId = record.record_type === 'gift' ? record.from_user : record.payer

            const isMe = postAuthorId === identity
            const currentAvatarUrl = isMe ? avatarUrl : partnerAvatarUrl
            const currentDisplayName = isMe ? '我' : partnerName

            const hasImages = record.image_urls && record.image_urls.length > 0
            const typeLabel = record.record_type === 'gift' ? '礼物记录' : 'AA结账'

            return (
              <div key={record.id} style={{
                display: 'flex',
                gap: '12px',
                padding: '16px 0',
                borderBottom: '1px solid var(--border)'
              }}>
                {/* Left side: Avatar */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    overflow: 'hidden'
                  }}>
                    {currentAvatarUrl ? (
                      <img src={currentAvatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        {currentDisplayName?.slice(0, 1)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name */}
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--blue)', marginBottom: '4px' }}>
                    {currentDisplayName}
                  </div>

                  {/* Text Description */}
                  {record.source_text && (
                    <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: hasImages ? '12px' : '8px' }}>
                      {record.source_text}
                    </div>
                  )}

                  {/* Image Grid */}
                  {hasImages && (
                    <div style={{
                      display: 'grid',
                      gap: '4px',
                      gridTemplateColumns: record.image_urls!.length === 1 ? 'minmax(0, 200px)' : 'repeat(3, minmax(0, 80px))',
                      marginBottom: '10px'
                    }}>
                      {record.image_urls!.map((url, idx) => {
                        // If it's a blob:// URL (local mock), use it directly. Otherwise construct Supabase URL.
                        const isBlob = url.startsWith('blob:')
                        const storageUrl = isBlob ? url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/record_images${url}`

                        return (
                          <div
                            key={idx}
                            style={{
                              aspectRatio: record.image_urls!.length === 1 ? 'auto' : '1/1',
                              maxHeight: record.image_urls!.length === 1 ? '200px' : 'none',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              background: 'var(--bg-secondary)',
                              cursor: 'zoom-in',
                              opacity: record.is_uploading ? 0.6 : 1, // Visual indication if still uploading in moments tab
                            }}
                            onClick={() => setEnlargedImage(storageUrl)}
                          >
                            <img
                              src={storageUrl}
                              alt="moment image"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Footer metadata */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: record.is_uploading ? 'var(--blue)' : 'var(--text-muted)' }}>
                        {record.is_uploading ? '入库中...' : formatMomentTime(record.created_at)}
                      </span>
                    </div>
                    {record.category && (
                      <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                        {record.category} - {typeLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
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
