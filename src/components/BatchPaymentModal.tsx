'use client'

import { useState } from 'react'
import { X, CheckCircle2, ChevronRight, HandCoins } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface BatchPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  records: any[]
  partnerName: string
  alipayCode: string
  onConfirm: (ids: string[]) => void
}

export function BatchPaymentModal({
  isOpen,
  onClose,
  records,
  partnerName,
  alipayCode,
  onConfirm
}: BatchPaymentModalProps) {
  const [step, setStep] = useState<'select' | 'confirm'>('select')

  if (!isOpen || records.length === 0) return null

  const totalAmount = records.reduce((sum, r) => sum + (r.displayAmount || 0), 0)
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
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>应付给 {partnerName}</p>
                <h2 style={{ fontSize: '36px', fontWeight: '900', color: 'var(--accent)' }}>{formatCurrency(totalAmount)}</h2>
                <div style={{ 
                  display: 'inline-block', padding: '4px 12px', borderRadius: '20px', 
                  background: 'var(--bg-secondary)', fontSize: '12px', color: 'var(--text-muted)',
                  marginTop: '8px', fontWeight: '600'
                }}>
                  共 {records.length} 笔待处理
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>费用明细</p>
                {records.map((r) => (
                  <div key={r.id} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.aa_items?.map((i: any) => i.name).join('、') || '未命名支出'}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.date}</p>
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)' }}>
                      {formatCurrency(r.displayAmount)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  <span>一键通过支付宝结清</span>
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => {
                    // Manual confirm
                    setStep('confirm')
                  }}
                  className="btn btn-ghost"
                  style={{ width: '100%', fontSize: '13px', color: 'var(--text-muted)' }}
                >
                  手动结清 (不拉起支付)
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ color: 'var(--green)', marginBottom: '16px' }}>
                <CheckCircle2 size={64} strokeWidth={1} style={{ margin: '0 auto' }} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>确认已支付完成？</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '30px', lineHeight: '1.6' }}>
                请确认你已经向 {partnerName} 支付了 <span style={{ color: 'var(--accent)', fontWeight: '700' }}>{formatCurrency(totalAmount)}</span>。<br/>
                系统将一次性更新这 {records.length} 笔记录。
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('select')}>刷新</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 2, background: 'var(--green)' }}
                  onClick={() => {
                    onConfirm(records.map(r => r.id))
                    onClose()
                  }}
                >
                  确认已结清
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
      `}</style>
    </div>
  )
}
