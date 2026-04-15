'use client'

import React from 'react'
import { Trash2 } from 'lucide-react'
import { formatMomentTime } from '@/lib/utils'

interface MomentCardProps {
  moment: any
  identity: string
  partnerName: string
  avatarUrl?: string
  partnerAvatarUrl?: string
  onDelete: (id: string, type: string) => void
  onEnlargeImage: (url: string) => void
}

export default function MomentCard({
  moment,
  identity,
  partnerName,
  avatarUrl,
  partnerAvatarUrl,
  onDelete,
  onEnlargeImage
}: MomentCardProps) {
  const { type, main, items } = moment

  if (type === 'insight') {
    return (
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '20px 0',
        borderBottom: '1px solid var(--border)'
      }}>
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
            {main.content}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {formatMomentTime(main.created_at)} · AI见解
          </div>
        </div>
      </div>
    )
  }

  // Determine author of the post based on lead record
  const postAuthorId = main.record_type === 'gift' ? main.from_user : main.payer
  const isMe = postAuthorId === identity
  const currentAvatarUrl = isMe ? avatarUrl : partnerAvatarUrl
  const currentDisplayName = isMe ? '我' : partnerName

  // Union of all unique images in the group
  const allImages = Array.from(new Set(items.flatMap((i: any) => i.image_urls || [])))
  const hasImages = allImages.length > 0

  return (
    <div style={{
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
        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--blue)', marginBottom: '4px' }}>
          {currentDisplayName}
        </div>

        {main.source_text && (
          <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '10px' }}>
            {main.source_text}
          </div>
        )}

        {/* Image Grid */}
        {hasImages && (
          <div style={{
            display: 'grid',
            gap: '4px',
            gridTemplateColumns: allImages.length === 1 ? 'minmax(0, 200px)' : 'repeat(3, minmax(0, 80px))',
            marginBottom: '10px'
          }}>
            {allImages.map((url: any, idx: number) => {
              const isBlob = url.startsWith('blob:')
              const storageUrl = isBlob ? url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/record_images${url}`

              return (
                <div
                  key={idx}
                  style={{
                    aspectRatio: allImages.length === 1 ? 'auto' : '1/1',
                    maxHeight: allImages.length === 1 ? '200px' : 'none',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: 'var(--bg-secondary)',
                    cursor: 'zoom-in',
                    opacity: main.is_uploading ? 0.6 : 1,
                  }}
                  onClick={() => onEnlargeImage(storageUrl)}
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
            <span style={{ fontSize: '12px', color: main.is_uploading ? 'var(--blue)' : 'var(--text-muted)' }}>
              {main.is_uploading ? '入库中...' : formatMomentTime(main.created_at)}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from(new Set(items.map((i: any) => i.record_type === 'gift' ? '礼物' : '支出'))).map((typeLabel: any) => (
                <span key={typeLabel} style={{ fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                  {typeLabel}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => onDelete(main.id, main.record_type)} style={{ 
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' 
            }}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
