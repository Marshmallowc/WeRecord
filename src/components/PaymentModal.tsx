'use client'

import { useState } from 'react'
import { X, CheckCircle2, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  amount: number
  billName: string
  partnerName: string
  alipayCode: string // This should be the content of the permanent QR code (e.g., https://qr.alipay.com/...)
  onConfirm: () => void
}

export function PaymentModal({
  isOpen,
  onClose,
  amount,
  billName,
  partnerName,
  alipayCode,
  onConfirm
}: PaymentModalProps) {
  const [step, setStep] = useState<'select' | 'confirm'>('select')

  if (!isOpen) return null

  // Generate Alipay deep link
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
        width: '100%', maxWidth: '400px', padding: '0', overflow: 'hidden',
        background: 'var(--bg-card)', border: '1px solid var(--border)'
      }}>
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700' }}>结清账单</h3>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '4px' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '24px' }}>
          {step === 'select' ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>应付给 {partnerName}</p>
                <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-primary)' }}>{formatCurrency(amount)}</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{billName}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={handlePayClick}
                  style={{
                    background: '#00A3EE', color: '#fff', border: 'none',
                    padding: '16px', borderRadius: '12px', fontSize: '15px', fontWeight: '700',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    boxShadow: '0 4px 15px rgba(0, 163, 238, 0.3)'
                  }}
                >
                  <img src="https://img.alicdn.com/tfs/TB1qEueazuSBuNjy1XcXXcYjFXa-200-200.png" style={{ width: '20px', height: '20px' }} alt="Alipay" />
                  使用支付宝结清
                </button>
                <button
                  disabled
                  style={{
                    background: '#07C160', color: '#fff', border: 'none',
                    padding: '16px', borderRadius: '12px', fontSize: '15px', fontWeight: '700',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    opacity: 0.5, cursor: 'not-allowed'
                  }}
                >
                  <img src="https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico" style={{ width: '20px', height: '20px' }} alt="WeChat" />
                  使用微信支付 (暂未开放)
                </button>
              </div>

              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                点击支付宝后将自动拉起 App 或识别收款码
              </p>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ color: 'var(--green)', marginBottom: '16px' }}>
                <CheckCircle2 size={64} strokeWidth={1} style={{ margin: '0 auto' }} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>已完成支付？</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '30px', lineHeight: '1.6' }}>
                系统无法自动感知支付状态，
                请在确保支付成功后点击下方按钮。
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('select')}>返回</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 2, background: 'var(--green)' }}
                  onClick={() => {
                    onConfirm()
                    onClose()
                  }}
                >
                  确认已支付
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
