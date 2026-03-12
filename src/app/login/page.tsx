'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Sparkles, Loader2, Github, Chrome, Apple, Lock, ArrowRight, UserPlus } from 'lucide-react'

type AuthMode = 'magic-link' | 'password-login' | 'password-signup'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>('password-login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    if (error) {
      setMessage({
        type: 'error',
        text: errorDescription || (error === 'auth-failed' ? '身份验证失败，请尝试重新登录。' : '发生未知错误。')
      })
    }
  }, [searchParams])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (mode === 'magic-link') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
        })
        if (error) throw error
        setMessage({ type: 'success', text: '神奇链接已发送至您的邮箱，请核对。' })
      } else if (mode === 'password-login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` }
        })
        if (error) throw error
        setMessage({ type: 'success', text: '注册成功！请查收验证邮件以激活账号。' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '操作失败' })
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'github' | 'apple') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/confirm` },
    })
    if (error) setMessage({ type: 'error', text: error.message })
  }

  return (
    <div className="fade-in" style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(circle at top right, rgba(232,149,109,0.1), transparent 40%), radial-gradient(circle at bottom left, rgba(125,184,247,0.1), transparent 40%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="premium-card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '48px 32px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        borderRadius: '24px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, var(--accent), #ffb28a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: '#fff',
          boxShadow: '0 10px 20px rgba(232,149,109,0.25)',
        }}>
          <Sparkles size={32} strokeWidth={1.5} />
        </div>

        <h1 style={{
          fontSize: '26px',
          fontWeight: '900',
          marginBottom: '8px',
          letterSpacing: '-0.8px',
          color: '#fff'
        }}>
          {mode === 'password-login' ? '欢迎回来' : mode === 'password-signup' ? '开启记录' : '神奇链接'}
        </h1>
        
        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.03)',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '32px',
          marginTop: '16px'
        }}>
          {[
            { id: 'password-login', label: '登录' },
            { id: 'password-signup', label: '注册' },
            { id: 'magic-link', label: '免密' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setMode(tab.id as AuthMode); setMessage(null); }}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                background: mode === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: mode === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="email"
              placeholder="电子邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {mode !== 'magic-link' && (
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={inputStyle}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? <Loader2 size={20} className="spin" /> : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {mode === 'password-login' ? '立即登录' : mode === 'password-signup' ? '即刻加入' : '发送链接'}
                <ArrowRight size={16} />
              </span>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <span>更多登录方式</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {['google', 'github', 'apple'].map(id => (
            <button
              key={id}
              onClick={() => handleOAuthLogin(id as any)}
              style={socialButtonStyle}
            >
              {id === 'google' && <Chrome size={18} />}
              {id === 'github' && <Github size={18} />}
              {id === 'apple' && <Apple size={18} />}
            </button>
          ))}
        </div>

        {message && (
          <div className="fade-in" style={{
            marginTop: '24px',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            textAlign: 'left',
            background: message.type === 'success' ? 'rgba(111,207,151,0.08)' : 'rgba(235,87,87,0.08)',
            color: message.type === 'success' ? '#6fcf97' : '#eb5757',
            border: `1px solid ${message.type === 'success' ? 'rgba(111,207,151,0.15)' : 'rgba(235,87,87,0.15)'}`
          }}>
            {message.text}
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: '32px', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', opacity: 0.5 }}>
        WERE CORD &bull; SECURE AUTHENTICATION
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 14px 14px 44px',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(255, 255, 255, 0.02)',
  fontSize: '14px',
  color: '#fff',
  outline: 'none',
  transition: 'all 0.2s ease'
}

const buttonStyle: React.CSSProperties = {
  marginTop: '8px',
  padding: '14px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: '15px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease'
}

const socialButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  background: 'rgba(255, 255, 255, 0.02)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
}
