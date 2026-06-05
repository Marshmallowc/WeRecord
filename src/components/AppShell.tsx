'use client'

import { useIdentity } from '@/context/IdentityContext'
import IdentitySelector from './IdentitySelector'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ScrollText, BarChart2, Settings, User, Aperture, Sparkles, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import useSWR from 'swr'
import { formatCurrency } from '@/lib/utils'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, identity, displayName, avatarUrl } = useIdentity()
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  // Fetch pending records for settlement capsule
  const { data: pendingData } = useSWR(user ? '/api/records/pending' : null, url => fetch(url).then(res => res.json()))

  const { hasUnsettledBills, netOwedByMe } = useMemo(() => {
    const pendingRecords = pendingData?.data ?? []
    if (!identity || pendingRecords.length === 0) {
      return { hasUnsettledBills: false, netOwedByMe: 0 }
    }

    let tIOwe = 0
    let tTheyOwe = 0

    pendingRecords.forEach((r: any) => {
      if (r.record_type !== 'aa' || r.status === 'settled') return

      const isMePayer = r.payer === identity
      const effectiveMyShare = identity === 'me' ? (r.my_share || 0) : ((r.total_amount || 0) - (r.my_share || 0))
      const effectiveHerShare = (r.total_amount || 0) - effectiveMyShare

      if (!isMePayer && effectiveMyShare > 0) {
        tIOwe += effectiveMyShare
      } else if (isMePayer && effectiveHerShare > 0) {
        tTheyOwe += effectiveHerShare
      }
    })

    const net = tIOwe - tTheyOwe
    const hasUnsettled = tIOwe > 0 || tTheyOwe > 0

    return {
      hasUnsettledBills: hasUnsettled,
      netOwedByMe: net
    }
  }, [pendingData, identity])

  // If we're not on the login page and we don't have a user yet, 
  // we show a simple loading state or nothing, as the middleware will redirect to /login if needed.
  if (!user && !isLoginPage) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="spin" style={{ width: '30px', height: '30px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
    </div>
  )

  const tabs = [
    { href: '/', label: 'AI助手', icon: Sparkles },
    { href: '/records', label: '账本', icon: ScrollText },
    { href: '/stats', label: '统计', icon: BarChart2 },
    { href: '/moments', label: '动态', icon: Aperture },
    { href: '/settings', label: '设置', icon: Settings },
  ]

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: '520px', margin: '0 auto', background: 'var(--bg-primary)' }}>
      {/* Top bar - cleaner */}
      {!isLoginPage && (
        <header className="glass" style={{
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 40,
          borderBottom: '1px solid var(--border)',
        }}>
          {pathname === '/records' ? (
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              账本
            </span>
          ) : (
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              WeRecord
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pathname === '/records' && hasUnsettledBills && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-batch-settle'))}
                className="fade-in"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '800',
                  background: netOwedByMe > 0 ? 'var(--red-bg)' : 'var(--green-bg)',
                  border: `1px solid ${netOwedByMe > 0 ? 'rgba(235, 87, 87, 0.15)' : 'rgba(111, 207, 151, 0.15)'}`,
                  color: netOwedByMe > 0 ? 'var(--red)' : 'var(--green)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginRight: '4px',
                  boxShadow: 'none'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.background = netOwedByMe > 0 ? 'var(--red)' : 'var(--green)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.background = netOwedByMe > 0 ? 'var(--red-bg)' : 'var(--green-bg)'
                  e.currentTarget.style.color = netOwedByMe > 0 ? 'var(--red)' : 'var(--green)'
                }}
              >
                {netOwedByMe > 0 ? `应付 ¥${Math.round(netOwedByMe)}` : `应收 ¥${Math.round(Math.abs(netOwedByMe))}`}
              </button>
            )}
            {pathname === '/' && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('clear-chat-history'))}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px',
                  transition: 'color 0.2s', marginRight: '2px', outline: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                title="清空会话"
              >
                <Trash2 size={16} />
              </button>
            )}
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>{displayName}</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Me" style={{ width: '100%', height: '100%' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={16} color="var(--text-muted)" />
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main style={{ flex: 1, padding: isLoginPage ? '0' : '20px 16px', paddingBottom: isLoginPage ? '0' : '100px' }}>
        {children}
      </main>

      {/* Bottom Tab Nav */}
      {!isLoginPage && (
        <nav className="glass" style={{
          display: 'flex', position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '520px',
          padding: '12px 10px calc(12px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border)',
          zIndex: 50,
        }}>
          {tabs.map(tab => {
            const isActive = pathname === tab.href
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={true}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  textDecoration: 'none',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isActive ? 'translateY(-2px)' : 'none',
                }}
              >
                <div style={{
                  padding: '6px 16px', borderRadius: '12px',
                  background: isActive ? 'var(--accent-bg)' : 'transparent',
                  transition: 'all 0.3s ease',
                }}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: isActive ? '700' : '500' }}>{tab.label}</span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
