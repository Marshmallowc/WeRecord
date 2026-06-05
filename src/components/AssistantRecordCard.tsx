import React from 'react'
import { Check, Bell } from 'lucide-react'
import { formatCurrency, resolveStorageUrl } from '@/lib/utils'
import SmartTitle from '@/components/SmartTitle'

interface AAItem {
  name: string
  amount: number
  category: string
}

interface MockRecord {
  id: string
  record_type: 'gift' | 'aa'
  date: string
  title?: string
  total_amount?: number
  my_share?: number
  amount?: number
  payer?: string
  from_user?: string
  to_user?: string
  status?: 'pending' | 'settled'
  note?: string
  aa_items?: AAItem[]
  category?: string
  is_draft?: boolean
  image_urls?: string[]
}

interface AssistantRecordCardProps {
  rec: MockRecord
  identity: 'me' | 'her' | null
  partnerName: string
  onSettle: (recordId: string, totalAmount: number, myShare: number, aaItems: any[]) => void
  onNudge: (record: any) => void
  onConfirmDraft?: (draftId: string, record: any) => void
  onDiscardDraft?: (draftId: string) => void
}

export default function AssistantRecordCard({
  rec,
  identity,
  partnerName,
  onSettle,
  onNudge,
  onConfirmDraft,
  onDiscardDraft
}: AssistantRecordCardProps) {
  const isGift = rec.record_type === 'gift'
  const isMePayer = isGift ? rec.from_user === identity : rec.payer === identity
  
  // Calculate personal share relative to current identity
  const effectiveMyShare = identity === 'me' ? (rec.my_share || 0) : ((rec.total_amount || 0) - (rec.my_share || 0))
  
  // Display amount: what the other person owes me, or what I owe them
  const displayAmount = isGift
    ? rec.amount
    : (isMePayer ? ((rec.total_amount || 0) - effectiveMyShare) : effectiveMyShare)

  const titleName = rec.aa_items?.map(i => i.name).join('、') || rec.title || '未命名支出'

  return (
    <div className="premium-card scale-in" style={{
      overflow: 'hidden', padding: 0, margin: '6px 0 0 0', background: 'var(--bg-card)',
      borderLeft: rec.is_draft 
        ? `4px dashed var(--accent)` 
        : `4px solid ${isGift ? 'var(--accent)' : (isMePayer ? 'var(--blue)' : 'var(--green)')}`,
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)'
    }}>
      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{
                fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px',
                background: rec.is_draft
                  ? 'var(--accent-bg)'
                  : (isGift ? 'var(--accent-bg)' : (isMePayer ? 'var(--blue-bg)' : 'var(--green-bg)')),
                color: rec.is_draft
                  ? 'var(--accent)'
                  : (isGift ? 'var(--accent)' : (isMePayer ? 'var(--blue)' : 'var(--green)'))
              }}>
                {rec.is_draft ? '待确认草稿' : (isGift ? '礼物' : '支出')}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{rec.date}</span>
            </div>
            <SmartTitle
              type={isGift ? 'gift' : 'aa'}
              title={isGift ? rec.title : ''}
              items={rec.aa_items}
              note={rec.note}
              fontSize="13.5px"
            />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {isGift
                ? (rec.from_user === identity ? `我送给${partnerName}` : `${partnerName}送我的`)
                : (rec.payer === identity ? '我已支付' : `${partnerName}已支付`)
              }
            </span>

            {/* Attachment image previews */}
            {rec.image_urls && rec.image_urls.length > 0 && (
              <div 
                className="no-scrollbar"
                style={{ 
                  display: 'flex', 
                  gap: '6px', 
                  marginTop: '8px', 
                  overflowX: 'auto', 
                  paddingBottom: '4px',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {rec.image_urls.map((url, i) => (
                  <img
                    key={i}
                    src={resolveStorageUrl(url)}
                    alt="attachment"
                    style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: '8px', 
                      objectFit: 'cover', 
                      border: '1px solid var(--border)', 
                      flexShrink: 0 
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '900', color: !isGift && rec.status === 'settled' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {formatCurrency(displayAmount || 0)}
            </div>
            {!isGift && !rec.is_draft && (
              <span style={{ fontSize: '9px', color: rec.status === 'settled' ? 'var(--green)' : 'var(--text-muted)', fontWeight: '800' }}>
                {rec.status === 'settled' ? '已结清' : (isMePayer ? '对方待付' : '我待付')}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Action Panel inside Card */}
        {!isGift && !rec.is_draft && rec.status === 'pending' && (
          <div style={{
            display: 'flex', gap: '8px', marginTop: '10px',
            borderTop: '1px solid var(--border)', paddingTop: '8px'
          }}>
            <button
              onClick={() => onSettle(rec.id, rec.total_amount || 0, rec.my_share || 0, rec.aa_items || [])}
              className="btn"
              style={{
                flex: 1, padding: '6px 12px', fontSize: '11px', borderRadius: '8px',
                background: 'var(--accent)', color: '#fff', fontWeight: '800',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}
            >
              <Check size={12} strokeWidth={3} />
              结清
            </button>
            {isMePayer && (
              <button
                onClick={() => onNudge(rec)}
                className="btn"
                style={{
                  flex: 1, padding: '6px 12px', fontSize: '11px', borderRadius: '8px',
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', fontWeight: '700',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                }}
              >
                <Bell size={11} />
                提醒 Ta
              </button>
            )}
          </div>
        )}

        {/* Draft Confirmation Buttons */}
        {rec.is_draft && (
          <div style={{
            display: 'flex', gap: '8px', marginTop: '10px',
            borderTop: '1px solid var(--border)', paddingTop: '8px'
          }}>
            <button
              onClick={() => onDiscardDraft && onDiscardDraft(rec.id)}
              className="btn"
              style={{
                flex: 1, padding: '6px 12px', fontSize: '11px', borderRadius: '8px',
                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', fontWeight: '700',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}
            >
              取消
            </button>
            <button
              onClick={() => onConfirmDraft && onConfirmDraft(rec.id, rec)}
              className="btn"
              style={{
                flex: 2, padding: '6px 12px', fontSize: '11px', borderRadius: '8px',
                background: 'var(--accent)', color: '#fff', fontWeight: '800',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}
            >
              <Check size={12} strokeWidth={3} />
              确认记入账本
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
