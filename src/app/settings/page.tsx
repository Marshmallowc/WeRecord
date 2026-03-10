'use client'

import { useState, useEffect } from 'react'
import { useIdentity } from '@/context/IdentityContext'
import { User, Check, Camera, RefreshCw, Bell, BellOff } from 'lucide-react'
import { urlBase64ToUint8Array } from '@/lib/utils'

const AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Viviyan',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bastian',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sasha',
]

export default function SettingsPage() {
  const { identity, displayName, avatarUrl, alipayCode, refreshProfiles, setIdentity } = useIdentity()
  const [name, setName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [alipay, setAlipay] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Sync with context when data arrives
  useEffect(() => {
    if (displayName) setName(displayName)
    if (alipayCode) setAlipay(alipayCode)
    if (avatarUrl) setSelectedAvatar(avatarUrl)
    else if (!selectedAvatar && AVATARS.length > 0) setSelectedAvatar(AVATARS[0])

    // Check push status
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub)
        })
      })
    }
  }, [displayName, alipayCode, avatarUrl])

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: identity,
          display_name: name,
          avatar_url: selectedAvatar,
          alipay_code: alipay,
        }),
      })
      if (!res.ok) throw new Error()
      await refreshProfiles()
      setMessage({ text: '设置已同步', ok: true })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ text: '保存失败', ok: false })
    } finally {
      setIsSaving(false)
    }
  }

  const switchIdentity = () => {
    setIdentity(identity === 'me' ? 'her' : 'me')
    window.location.reload() // Force reload to refresh context
  }

  const handlePushToggle = async () => {
    if (pushLoading) return
    setPushLoading(true)

    try {
      if (isSubscribed) {
        // Unsubscribe logic (optional, but good for completeness)
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          // Optionally notify server to delete from DB
          setIsSubscribed(false)
          setMessage({ text: '已关闭通知', ok: true })
        }
      } else {
        // Subscribe logic (REQUIRED for iOS to be triggered by tap)
        const reg = await navigator.serviceWorker.ready
        let sub = await reg.pushManager.getSubscription()

        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
          })
        }

        if (sub) {
          const res = await fetch('/api/push/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity, subscription: sub })
          })
          if (res.ok) {
            setIsSubscribed(true)
            setMessage({ text: '通知已成功开启！', ok: true })
          } else {
            throw new Error('Sync failed')
          }
        }
      }
    } catch (e: any) {
      console.error('Push toggle failed', e)
      setMessage({ text: e.name === 'NotAllowedError' ? '请在系统设置中允许通知权限' : '开启失败，请重试', ok: false })
    } finally {
      setPushLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 16px' }}>
          {selectedAvatar ? (
            <img
              src={selectedAvatar}
              alt="Avatar"
              style={{ width: '100%', height: '100%', borderRadius: '30px', background: 'var(--bg-secondary)', border: '2px solid var(--accent)' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '30px', background: 'var(--bg-secondary)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={40} color="var(--text-muted)" />
            </div>
          )}
          <div style={{
            position: 'absolute', bottom: '-4px', right: '-4px',
            width: '32px', height: '32px', borderRadius: '10px',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
          }}>
            <Camera size={16} />
          </div>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>{displayName}</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>个性化你的账户信息</p>
      </div>

      <div className="premium-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', fontWeight: '600' }}>
            我的昵称
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入你的名字"
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', fontWeight: '600' }}>
            支付宝收款码内容
          </label>
          <input
            className="input"
            value={alipay}
            onChange={(e) => setAlipay(e.target.value)}
            placeholder="粘贴你的支付宝收款码提取出的链接"
            style={{ fontFamily: 'monospace', fontSize: '13px' }}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            提示：使用支付宝扫一扫你自己的永久收款码，点击“查看详情/链接”并复制，粘贴到此处。
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', display: 'block', fontWeight: '600' }}>
            选择头像
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {AVATARS.map(url => (
              <div
                key={url}
                onClick={() => setSelectedAvatar(url)}
                style={{
                  position: 'relative', cursor: 'pointer', borderRadius: '50%',
                  overflow: 'hidden', border: selectedAvatar === url ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'var(--bg-secondary)', padding: '4px'
                }}
              >
                <img src={url} alt="Avatar Option" style={{ width: '100%', borderRadius: '50%' }} />
                {selectedAvatar === url && (
                  <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--accent)', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={10} color="#fff" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? '同步中...' : '保存并同步'}
        </button>

        {message && (
          <p style={{
            marginTop: '12px', textAlign: 'center', fontSize: '13px',
            color: message.ok ? 'var(--green)' : 'var(--red)',
            fontWeight: '600'
          }}>
            {message.text}
          </p>
        )}
      </div>

      <div className="premium-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-secondary)' }}>系统设置</h3>

        {/* Push Notification Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '600' }}>手机实时通知</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>开启以接收对方的记账提醒</p>
          </div>
          <button
            className="btn-ghost"
            onClick={handlePushToggle}
            disabled={pushLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              color: isSubscribed ? 'var(--green)' : 'var(--accent)',
              padding: '6px 12px', borderRadius: '100px', border: '1px solid'
            }}
          >
            {pushLoading ? <RefreshCw size={14} className="spin" /> : (isSubscribed ? <Bell size={14} /> : <BellOff size={14} />)}
            {isSubscribed ? '已开启' : '启用'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '600' }}>通知故障修复</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>如果收不到通知或报错，尝试重置</p>
          </div>
          <button
            className="btn-ghost"
            onClick={async () => {
              if (confirm('确定要重置通知服务吗？这将注销当前设备的所有推送设置并刷新页面。')) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                  await reg.unregister();
                }
                window.location.reload();
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            <RefreshCw size={14} /> 重置服务
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '600' }}>身份切换</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>当前身份：{displayName}</p>
          </div>
          <button className="btn-ghost" onClick={switchIdentity} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> 切换
          </button>
        </div>
      </div>
    </div>
  )
}
