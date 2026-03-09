'use client'

import { useIdentity } from '@/context/IdentityContext'
import type { UserType } from '@/lib/supabase'
import { Heart } from 'lucide-react'

export default function IdentitySelector() {
  const { setIdentity } = useIdentity()

  const options: { id: UserType; label: string; icon: string; desc: string; color: string }[] = [
    { id: 'me', label: '我', icon: '👦', desc: '记录我的视角与个人花销', color: 'var(--blue)' },
    { id: 'her', label: '她', icon: '👧', desc: '记录她的视角与个人动态', color: 'var(--accent)' },
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
        background: 'radial-gradient(circle at top right, #1a1917, #0f0e0d)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative Orbs */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-5%', width: '40%', height: '40%',
        background: 'radial-gradient(circle, rgba(232,149,109,0.08) 0%, transparent 70%)',
        zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-5%', width: '40%', height: '40%',
        background: 'radial-gradient(circle, rgba(125,184,247,0.08) 0%, transparent 70%)',
        zIndex: 0,
      }} />

      <div className="scale-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', zIndex: 1, position: 'relative' }}>
        {/* Logo Section */}
        <div style={{ marginBottom: '48px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 12px 30px rgba(232,149,109,0.3)',
              position: 'relative'
            }}
          >
            <div style={{ position: 'absolute', inset: '4px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px' }} />
            <Heart size={36} fill="#fff" strokeWidth={0} />
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-1px' }}>
            WeRecord
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ height: '1px', width: '20px', background: 'var(--border-strong)' }} />
            <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Couple Archive
            </span>
            <div style={{ height: '1px', width: '20px', background: 'var(--border-strong)' }} />
          </div>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', maxWidth: '280px', margin: '0 auto' }}>
            精细化管理你们的共享支出、礼物与成长点滴
          </p>
        </div>

        {/* Selection Box */}
        <div className="glass" style={{
          padding: '24px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: '600' }}>
            HI，请选择你的初始角色
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setIdentity(opt.id)}
                className="premium-card"
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '16px',
                    background: `linear-gradient(135deg, ${opt.color}20, ${opt.color}10)`,
                    border: `1px solid ${opt.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    flexShrink: 0,
                  }}
                >
                  {opt.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {opt.label}的账户
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {opt.desc}
                  </div>
                </div>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.color }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '32px', opacity: 0.6 }}>
          身份数据仅本地存储，你可以随时在设置中切换
        </p>
      </div>
    </div>
  )
}
