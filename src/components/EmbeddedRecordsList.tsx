import React, { useState } from 'react'
import AssistantRecordCard from './AssistantRecordCard'
import { ChevronDown, ChevronUp } from 'lucide-react'

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
}

interface EmbeddedRecordsListProps {
  records: MockRecord[]
  identity: 'me' | 'her' | null
  partnerName: string
  onSettle: (recordId: string, totalAmount: number, myShare: number, aaItems: any[]) => void
  onNudge: (record: any) => void
  onConfirmDraft?: (draftId: string, record: any) => void
  onDiscardDraft?: (draftId: string) => void
}

export default function EmbeddedRecordsList({
  records,
  identity,
  partnerName,
  onSettle,
  onNudge,
  onConfirmDraft,
  onDiscardDraft
}: EmbeddedRecordsListProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!records || records.length === 0) return null

  const threshold = 2
  const hasTooMany = records.length > threshold
  const visibleRecords = (hasTooMany && !isExpanded) 
    ? records.slice(0, threshold) 
    : records

  return (
    <div className="embedded-card-container">
      {visibleRecords.map((rec) => (
        <AssistantRecordCard
          key={rec.id}
          rec={rec}
          identity={identity}
          partnerName={partnerName}
          onSettle={onSettle}
          onNudge={onNudge}
          onConfirmDraft={onConfirmDraft}
          onDiscardDraft={onDiscardDraft}
        />
      ))}

      {hasTooMany && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          style={{
            width: '100%',
            padding: '10px',
            marginTop: '4px',
            background: 'transparent',
            backdropFilter: 'blur(10px)',
            border: '1px dashed var(--border)',
            borderRadius: '10px',
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-bg)'
            e.currentTarget.style.borderColor = 'var(--accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          {isExpanded ? (
            <>
              <span>收起超出的账单</span>
              <ChevronUp size={14} />
            </>
          ) : (
            <>
              <span>展开更多账单 (+{records.length - threshold}笔)</span>
              <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </div>
  )
}
