'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Loader2, Github, Chrome, Apple, Lock, ArrowRight, UserPlus, Info, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type AuthMode = 'magic-link' | 'password-login' | 'password-signup'
type UIStep = 'landing' | 'auth'

export default function LoginPage() {
  const [step, setStep] = useState<UIStep>('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>('password-login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const status = searchParams.get('status')

    if (error) {
      setStep('auth')
      setMessage({
        type: 'error',
        text: errorDescription || (error === 'auth-failed' ? '身份验证失败，请尝试重新登录。' : '发生未知错误。')
      })
    } else if (status === 'verified') {
      setStep('auth')
      setMessage({
        type: 'success',
        text: '账号验证成功！您现在可以返回原设备，或在此直接登录。'
      })
    }
    
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [searchParams])

  const startPolling = (userEmail: string, userPass: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    
    pollTimerRef.current = setInterval(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: userPass,
      })

      if (data?.session) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current)
        router.refresh()
        router.push('/')
      } else if (error && error.message !== 'Email not confirmed') {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      }
    }, 3000)
  }

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
        setMessage({ type: 'success', text: '验证链接已发送至邮箱，请查收。' })
        setLoading(false)
      } else if (mode === 'password-login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.refresh()
        setTimeout(() => router.push('/'), 150)
        return;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm?device=other` }
        })
        if (error) throw error
        setMessage({ 
          type: 'info', 
          text: '账号已创建，激活邮件已发送。验证后将自动进入。' 
        })
        startPolling(email, password)
        setLoading(false)
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '操作失败' })
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

  const toggleMode = (newMode: AuthMode) => {
    setMode(newMode)
    setStep('auth')
    setMessage(null)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#fff',
      color: '#2d2a28',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '520px',
      margin: '0 auto',
      position: 'relative',
      overflow: 'hidden'
    }} className="fade-in">
      <AnimatePresence mode="wait">
        {step === 'landing' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '0 32px 48px',
              textAlign: 'center'
            }}
          >
            {/* Hero Illustration Block */}
            <div style={{
              position: 'relative',
              marginTop: '40px',
              marginBottom: '40px'
            }}>
              {/* Soft background blob */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '120%',
                height: '100%',
                background: '#fcf6f0',
                borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%',
                zIndex: -1,
                opacity: 0.8
              }} />
              <img 
                src="/login-hero.png" 
                alt="WeRecord Hero" 
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '24px'
                }}
              />
            </div>

            {/* Slogan */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h1 style={{
                fontSize: '28px',
                fontWeight: '800',
                marginBottom: '16px',
                color: '#5c4b40',
                lineHeight: '1.3'
              }}>
                这一刻，<br />记录我们的专属记忆
              </h1>
              <p style={{
                fontSize: '15px',
                color: '#8c7e74',
                lineHeight: '1.6',
                marginBottom: '40px'
              }}>
                礼物、花销与感悟<br />让每一份精彩都有迹可循
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => toggleMode('password-signup')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    borderRadius: '16px',
                    border: 'none',
                    background: '#bc8a70',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 8px 16px rgba(188, 138, 112, 0.2)'
                  }}
                >
                  开启记录
                </button>
                <button
                  onClick={() => toggleMode('password-login')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid #e6e0da',
                    background: 'transparent',
                    color: '#8c7e74',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  直接登录
                </button>
              </div>

              {/* Social Login Divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '8px 0',
                color: '#d1c8bf'
              }}>
                <div style={{ flex: 1, height: '1px', background: '#f3f0ed' }} />
                <span style={{ fontSize: '12px', fontWeight: '500' }}>社交账号登录</span>
                <div style={{ flex: 1, height: '1px', background: '#f3f0ed' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => handleOAuthLogin('github')} style={socialLandingStyle}>
                  <Github size={20} />
                </button>
                <button onClick={() => handleOAuthLogin('google')} style={socialLandingStyle}>
                  <Chrome size={20} />
                </button>
                <button onClick={() => handleOAuthLogin('apple')} style={socialLandingStyle}>
                  <Apple size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="auth"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              flex: 1
            }}
          >
            {/* Header with back button */}
            <div style={{ marginBottom: '40px' }}>
              <button 
                onClick={() => setStep('landing')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8c7e74',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  padding: 0,
                  cursor: 'pointer',
                  marginBottom: '24px'
                }}
              >
                <ChevronLeft size={20} /> 返回
              </button>
              <h2 style={{
                fontSize: '28px',
                fontWeight: '800',
                color: '#5c4b40'
              }}>
                {mode === 'password-login' ? '欢迎回来' : mode === 'password-signup' ? '即刻加入' : '发送链接'}
              </h2>
            </div>

            {/* Mode Switcher */}
            <div style={{
              display: 'flex',
              background: '#f9f7f5',
              padding: '4px',
              borderRadius: '12px',
              marginBottom: '32px'
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
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    background: mode === tab.id ? '#fff' : 'transparent',
                    color: mode === tab.id ? '#bc8a70' : '#8c7e74',
                    boxShadow: mode === tab.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#d1c8bf' }} />
                <input
                  type="email"
                  placeholder="电子邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputFormStyle}
                />
              </div>

              {mode !== 'magic-link' && (
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#d1c8bf' }} />
                  <input
                    type="password"
                    placeholder="密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={inputFormStyle}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '12px',
                  padding: '16px',
                  borderRadius: '16px',
                  border: 'none',
                  background: '#bc8a70',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 16px rgba(188, 138, 112, 0.2)',
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? <Loader2 size={20} className="spin" /> : (
                  <>
                    <span>{mode === 'password-login' ? '登 录' : mode === 'password-signup' ? '注 册' : '发 送'}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginTop: '32px',
                    padding: '16px',
                    borderRadius: '16px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: message.type === 'success' ? '#f0f9f4' : (message.type === 'info' ? '#f0f7f9' : '#fef1f1'),
                    color: message.type === 'success' ? '#27ae60' : (message.type === 'info' ? '#1976d2' : '#d32f2f'),
                    border: `1px solid ${message.type === 'success' ? '#e1f2e8' : (message.type === 'info' ? '#e1f0f2' : '#fde7e7')}`
                  }}
                >
                  <Info size={18} />
                  <span>{message.text}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Footer text */}
      <div style={{ 
        padding: '24px', 
        textAlign: 'center', 
        fontSize: '11px', 
        color: '#d1c8bf', 
        letterSpacing: '1px',
        fontWeight: '600'
      }}>
        WERE CORD · 记录爱与瞬间
      </div>
    </div>
  )
}

const socialLandingStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #f3f0ed',
  background: '#fff',
  color: '#8c7e74',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
}

const inputFormStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px 16px 16px 48px',
  borderRadius: '16px',
  border: '1px solid #f3f0ed',
  background: '#f9f7f5',
  fontSize: '15px',
  color: '#2d2a28',
  outline: 'none',
  transition: 'border-color 0.2s ease'
}
