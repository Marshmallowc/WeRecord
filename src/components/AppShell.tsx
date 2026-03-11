'use client'

import { useIdentity } from '@/context/IdentityContext'
import IdentitySelector from './IdentitySelector'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BarChart2, Settings, User, Aperture } from 'lucide-react'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { identity, displayName, avatarUrl } = useIdentity()
  const pathname = usePathname()

  if (!identity) return <IdentitySelector />

  const tabs = [
    { href: '/', label: '记录', icon: Home },
    { href: '/stats', label: '统计', icon: BarChart2 },
    { href: '/moments', label: '动态', icon: Aperture },
    { href: '/settings', label: '设置', icon: Settings },
  ]

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: '520px', margin: '0 auto', background: 'var(--bg-primary)' }}>
      {/* Top bar - cleaner */}
      <header className="glass" style={{
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 40,
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          WeRecord
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      <main style={{ flex: 1, padding: '20px 16px', paddingBottom: '100px' }}>
        {children}
      </main>

      {/* Bottom Tab Nav */}
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
    </div>
  )
}
