'use client'

import { useIdentity } from '@/context/IdentityContext'
import type { UserType } from '@/lib/supabase'
import { Heart } from 'lucide-react'

export default function IdentitySelector() {
  const { setIdentity } = useIdentity()

  const options: { id: UserType; label: string; desc: string }[] = [
    { id: 'me', label: '我', desc: '以"我"的身份使用' },
    { id: 'her', label: '她', desc: '以"她"的身份使用' },
  ]

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--bg-primary)',
      }}
    >
      <div className="slide-up" style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'var(--accent-bg)',
              border: '1px solid rgba(232,149,109,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <Heart size={28} fill="var(--accent)" strokeWidth={0} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
            WeRecord
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            记录我们之间的礼物与花销
          </p>
        </div>

        {/* Selection */}
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          请选择你的身份
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setIdentity(opt.id)}
              style={{
                width: '100%',
                padding: '20px 24px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.borderColor = 'var(--accent)'
                el.style.background = 'var(--accent-bg)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.borderColor = 'var(--border)'
                el.style.background = 'var(--bg-card)'
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: '700',
                  color: 'var(--accent)',
                  flexShrink: 0,
                }}
              >
                {opt.label}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {opt.label}的视角
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {opt.desc}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '24px' }}>
          身份仅存储在本设备，随时可在顶部切换
        </p>
      </div>
    </div>
  )
}
