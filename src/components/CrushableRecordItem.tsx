'use client'

import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useState } from 'react'

interface CrushableRecordItemProps {
  record: any
  isVerifyMode: boolean
  isExpanded: boolean
  isLast: boolean
  onToggleExpand: () => void
  onEliminate: () => void
}

export function CrushableRecordItem({
  record,
  isVerifyMode,
  isExpanded,
  isLast,
  onToggleExpand,
  onEliminate
}: CrushableRecordItemProps) {
  const isCreditItem = record._type === 'credit'
  const [isExploding, setIsExploding] = useState(false)

  // 预生成爆炸碎片
  const [shards] = useState(() => {
    return Array.from({ length: 18 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2
      const velocity = Math.random() * 80 + 40
      return {
        id: i,
        x: Math.cos(angle) * velocity,
        y: Math.sin(angle) * velocity,
        rotate: (Math.random() - 0.5) * 500,
        scale: Math.random() * 0.8 + 0.4,
        color: ['#00A3EE', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'][Math.floor(Math.random() * 6)],
        isCircle: Math.random() > 0.5
      }
    })
  })

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', height: 'auto' }}
      exit={{
        height: 0,
        opacity: 0,
        marginBottom: 0,
        transition: { duration: 0.25, ease: 'easeIn' }
      }}
      style={{ originX: 0.5, originY: 0.5, position: 'relative' }}
    >
      {/* 碎片爆炸层 */}
      {isExploding && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          {shards.map(s => (
            <motion.div
              key={s.id}
              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
              animate={{ x: s.x, y: s.y, scale: s.scale, rotate: s.rotate, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{
                position: 'absolute',
                width: 10,
                height: 10,
                backgroundColor: s.color,
                borderRadius: s.isCircle ? '50%' : '2px', // 混合圆形和方形碎片
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            />
          ))}
        </div>
      )}

      {/* 主体内容（爆炸时瞬间缩小并变模糊） */}
      <motion.div
        animate={{
          opacity: isExploding ? 0 : 1,
          scale: isExploding ? 0.3 : 1,
          filter: isExploding ? 'blur(10px)' : 'blur(0px)'
        }}
        transition={{ duration: 0.2, ease: "easeIn" }}
      >
        {/* 提要行 */}
        <div
          onClick={() => {
            if (isVerifyMode) {
              if (isExploding) return
              setIsExploding(true)
              // 延迟通知父组件移除，以便让碎片飞一会儿
              setTimeout(() => {
                onEliminate()
              }, 250)
            } else {
              onToggleExpand()
            }
          }}
          style={{
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            background: isExpanded ? 'var(--bg-card)' : 'transparent',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.aa_items?.map((i: any) => i.name).join('、') || '未命名支出'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{record.date}</span>
              <span style={{
                fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                background: isCreditItem ? 'var(--green-bg)' : 'rgba(239, 68, 68, 0.1)',
                color: isCreditItem ? 'var(--green)' : 'var(--red)',
                fontWeight: '600'
              }}>
                {isCreditItem ? '我垫付的' : '对方垫付'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontWeight: '800', fontSize: '16px', color: isCreditItem ? 'var(--green)' : 'var(--red)' }}>
              {isCreditItem ? '+' : '-'}{formatCurrency(record.displayAmount)}
            </div>
            {!isVerifyMode && (
              <ChevronRight
                size={16}
                color="var(--text-muted)"
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
              />
            )}
          </div>
        </div>

        {/* 展开详情 */}
        {isExpanded && !isVerifyMode && (
          <div style={{
            padding: '0 16px 16px 16px',
            background: 'var(--bg-card)',
            borderBottom: !isLast ? '1px solid var(--border)' : 'none',
            animation: 'slideDown 0.2s ease-out'
          }}>
            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                <span>总金额</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(record.total_amount || 0)}</span>
              </div>
              {record.aa_items?.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
              {record.note && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                  备注: {record.note}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 分割线 */}
        {!isLast && !isExpanded && (
          <div style={{ height: '1px', background: 'var(--border)', margin: '0 16px' }} />
        )}
      </motion.div>
    </motion.div>
  )
}
