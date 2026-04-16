'use client'

import { useState, useMemo } from 'react'
import { X, CheckCircle2, ChevronRight, HandCoins } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface BatchPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  iOweRecords: any[]
  theyOweRecords: any[]
  netAmount: number
  partnerName: string
  alipayCode: string
  onConfirm: (ids: string[]) => void
}

export function BatchPaymentModal({
  isOpen,
  onClose,
  iOweRecords,
  theyOweRecords,
  netAmount,
  partnerName,
  alipayCode,
  onConfirm
}: BatchPaymentModalProps) {
  const [step, setStep] = useState<'select' | 'confirm'>('select')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!isOpen || (iOweRecords.length === 0 && theyOweRecords.length === 0)) return null

  const isDebt = netAmount > 0
  const isCredit = netAmount < 0
  const isOffsetOnly = netAmount === 0
  const allRecords = [...iOweRecords, ...theyOweRecords]

  const sortedUnifiedRecords = useMemo(() => {
    return [
      ...iOweRecords.map(r => ({ ...r, _type: 'owe' })),
      ...theyOweRecords.map(r => ({ ...r, _type: 'credit' }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [iOweRecords, theyOweRecords])
  const alipayDeepLink = alipayCode
    ? `alipays://platformapi/startapp?saId=10000007&qrcode=${encodeURIComponent(alipayCode)}`
    : '#'

  const handlePayClick = () => {
    if (alipayCode) {
      window.location.href = alipayDeepLink
      setStep('confirm')
    } else {
      alert('对方尚未配置支付宝收款码，请先手动转账。')
    }
  }

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div className="premium-card slide-up" style={{
        width: '100%', maxWidth: '450px', padding: '0', overflow: 'hidden',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--accent-bg)', color: 'var(--accent)' }}>
              <HandCoins size={18} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>批量结清明细</h3>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '4px' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {step === 'select' ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {isOffsetOnly ? '无需转账' : isDebt ? `应付给 ${partnerName} 的净额` : `待 ${partnerName} 结清的净额`}
                </p>
                <h2 style={{ fontSize: '36px', fontWeight: '900', color: isOffsetOnly || isCredit ? 'var(--green)' : 'var(--red)' }}>
                  {isOffsetOnly ? '已平账' : formatCurrency(Math.abs(netAmount))}
                </h2>
                <div style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
                  background: 'var(--bg-secondary)', fontSize: '12px', color: 'var(--text-muted)',
                  marginTop: '8px', fontWeight: '600'
                }}>
                  共合并处理 {allRecords.length} 笔账单
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>交易明细</p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {sortedUnifiedRecords.map((r, index) => {
                    const isCredit = r._type === 'credit'
                    const isExpanded = expandedId === r.id
                    return (
                      <div key={r.id}>
                        {/* 提要行 */}
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          style={{
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            background: isExpanded ? 'var(--bg-card)' : 'transparent',
                            transition: 'background 0.2s',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.aa_items?.map((i: any) => i.name).join('、') || '未命名支出'}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.date}</span>
                              <span style={{
                                fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                                background: isCredit ? 'var(--green-bg)' : 'rgba(239, 68, 68, 0.1)',
                                color: isCredit ? 'var(--green)' : 'var(--red)',
                                fontWeight: '600'
                              }}>
                                {isCredit ? '我垫付的' : '对方垫付'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ fontWeight: '800', fontSize: '16px', color: isCredit ? 'var(--green)' : 'var(--red)' }}>
                              {isCredit ? '+' : '-'}{formatCurrency(r.displayAmount)}
                            </div>
                            <ChevronRight
                              size={16}
                              color="var(--text-muted)"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                            />
                          </div>
                        </div>

                        {/* 展开详情 */}
                        {isExpanded && (
                          <div style={{
                            padding: '0 16px 16px 16px',
                            background: 'var(--bg-card)',
                            borderBottom: index < sortedUnifiedRecords.length - 1 ? '1px solid var(--border)' : 'none',
                            animation: 'slideDown 0.2s ease-out'
                          }}>
                            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '13px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                <span>总金额</span>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(r.total_amount || 0)}</span>
                              </div>
                              {r.aa_items?.map((item: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                  <span style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                                  <span>{formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                              {r.note && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                                  备注: {r.note}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 分割线 */}
                        {index < sortedUnifiedRecords.length - 1 && !isExpanded && (
                          <div style={{ height: '1px', background: 'var(--border)', margin: '0 16px' }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isDebt && (
                  <button
                    onClick={handlePayClick}
                    style={{
                      background: '#00A3EE', color: '#fff', border: 'none',
                      padding: '16px', borderRadius: '14px', fontSize: '15px', fontWeight: '700',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: '0 4px 15px rgba(0, 163, 238, 0.3)', width: '100%', cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      width: '22px', height: '22px', background: '#fff', color: '#00A3EE',
                      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: '900', flexShrink: 0
                    }}>
                      支
                    </div>
                    <span>一键通过支付宝结清差额</span>
                    <ChevronRight size={18} />
                  </button>
                )}
                <button
                  onClick={() => {
                    // Manual confirm
                    setStep('confirm')
                  }}
                  className={!isDebt ? "btn-primary" : "btn btn-ghost"}
                  style={{
                    width: '100%', fontSize: '13px',
                    padding: !isDebt ? '16px' : undefined,
                    borderRadius: !isDebt ? '14px' : undefined,
                    color: !isDebt ? '#fff' : 'var(--text-muted)',
                    background: isCredit ? 'var(--orange, #f59e0b)' : undefined
                  }}
                >
                  {isOffsetOnly ? '直接抵消平账' : isCredit ? '确认已收到款项' : '手动结清 (不拉起支付)'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ color: 'var(--green)', marginBottom: '16px' }}>
                <CheckCircle2 size={64} strokeWidth={1} style={{ margin: '0 auto' }} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>
                {isOffsetOnly ? '确认平账？' : isDebt ? '确认已支付完成？' : '确认已全部收款？'}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '30px', lineHeight: '1.6' }}>
                {isOffsetOnly
                  ? <>这 {allRecords.length} 笔记录的总金额已完全抵消，系统将直接把它们全标记为已结清。</>
                  : isDebt
                    ? <>请确认你已经向 {partnerName} 支付了净差额 <span style={{ color: 'var(--accent)', fontWeight: '700' }}>{formatCurrency(Math.abs(netAmount))}</span>。<br />系统将一次性平账这 {allRecords.length} 笔记录。</>
                    : <>请确认你已经收到了 {partnerName} 支付的净差额 <span style={{ color: 'var(--orange, #f59e0b)', fontWeight: '700' }}>{formatCurrency(Math.abs(netAmount))}</span>。<br />系统将同步平账这 {allRecords.length} 笔记录。</>}
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('select')}>刷新</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 2, background: 'var(--green)' }}
                  onClick={() => {
                    onConfirm(allRecords.map(r => r.id))
                    onClose()
                  }}
                >
                  {isOffsetOnly ? '确认平账' : '确认已结清'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          animation: fadeIn 0.3s ease-out;
        }
        .slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
