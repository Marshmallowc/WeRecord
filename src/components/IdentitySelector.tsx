'use client'

import { useIdentity } from '@/context/IdentityContext'
import type { UserType } from '@/lib/supabase'
import { ArrowRight } from 'lucide-react'
import { setIdentityCookie } from '@/app/actions'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export default function IdentitySelector() {
  const { setIdentity } = useIdentity()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSelect = (id: UserType) => {
    // Set locally for immediate UI reaction
    setIdentity(id)

    // Set cookie and refresh server components
    startTransition(async () => {
      await setIdentityCookie(id)
      router.refresh()
    })
  }

  const options: { id: UserType; label: string; sub: string; color: string }[] = [
    { id: 'me', label: 'PERSPECTIVE M', sub: 'The Origin / Primary User', color: '#7db8f7' },
    { id: 'her', label: 'PERSPECTIVE F', sub: 'The Companion / Secondary User', color: '#e8956d' },
  ]

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        backgroundColor: '#050505',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}
    >
      {/* Immersive Noise / Grain Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.15,
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />

      {/* Floating Ambient Light */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(232,149,109,0.03) 0%, transparent 60%)',
        filter: 'blur(80px)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <header style={{ textAlign: 'center', marginBottom: '100px', zIndex: 1, letterSpacing: '0.2em' }}>
        <h1 style={{
          fontSize: '11px',
          fontWeight: '500',
          color: 'rgba(255,255,255,0.3)',
          marginBottom: '20px',
          textTransform: 'uppercase',
          animation: 'fadeIn 2s ease-out'
        }}>
          Identity Initialization Protocol
        </h1>
        <div style={{
          fontSize: '42px',
          fontWeight: '200',
          lineHeight: '1',
          color: '#fff',
          animation: 'fadeIn 1.5s ease-out'
        }}>
          WeRecord<span style={{ color: '#e8956d', fontWeight: '900' }}>.</span>
        </div>
      </header>

      <div style={{ width: '100%', maxWidth: '360px', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.08)' }}>
          {options.map((opt, index) => (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              disabled={isPending}
              className="option-button"
              style={{
                all: 'unset',
                cursor: 'pointer',
                padding: '40px 28px',
                background: '#0a0a0a',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                transition: 'background 0.4s ease, transform 0.4s ease',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  letterSpacing: '0.1em',
                  color: '#fff'
                }}>
                  {opt.label}
                </span>
                <ArrowRight size={18} className="arrow-icon" style={{ opacity: 0.2, transition: 'all 0.4s ease' }} />
              </div>
              <span style={{
                fontSize: '10px',
                color: 'rgba(255,255,255,0.25)',
                fontWeight: '400',
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}>
                {opt.sub}
              </span>

              {/* Animated Underline */}
              <div className="hover-underline" style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: '1px',
                width: '0',
                background: opt.color,
                transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
              }} />
            </button>
          ))}
        </div>
      </div>

      <footer style={{
        marginTop: '120px',
        zIndex: 1,
        textAlign: 'center',
        opacity: 0.15
      }}>
        <p style={{ fontSize: '9px', fontWeight: '400', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
          Encryption Active / Local Persistence
        </p>
      </footer>

      <style jsx>{`
        .option-button:hover {
          background: #111 !important;
        }
        .option-button:hover .hover-underline {
          width: 100% !important;
        }
        .option-button:hover .arrow-icon {
          transform: translateX(6px);
          opacity: 1 !important;
          color: #fff;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
