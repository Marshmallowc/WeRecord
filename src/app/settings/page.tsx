'use client'

import { useState, useEffect, useRef } from 'react'
import { useIdentity } from '@/context/IdentityContext'
import { createClient } from '@/lib/supabase/client'
import { User, Check, Camera, RefreshCw, Bell, BellOff, LogOut, Link2, Copy, Send } from 'lucide-react'
import { urlBase64ToUint8Array } from '@/lib/utils'

const AVATARS = [
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Maria',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Eden',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=George',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bastian',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sasha',
]

export default function SettingsPage() {
  const { identity, profile, user, displayName, avatarUrl, alipayCode, refreshProfiles, partnerProfile, signOut } = useIdentity()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [alipay, setAlipay] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Binding State
  const [inviteCode, setInviteCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [isBinding, setIsBinding] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const hasFetchedInviteCode = useRef(false)

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
          id: user?.id, // ✅ 使用 Auth 提供的绝对可靠的 UUID
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

  const fetchInviteCode = async () => {
    try {
      const res = await fetch('/api/invitation')
      const data = await res.json()
      if (data.code) setInviteCode(data.code)
    } catch (e) {
      console.error('Failed to fetch invite code', e)
    }
  }

  const handleJoin = async () => {
    if (!inputCode || isBinding) return
    setIsBinding(true)
    try {
      const res = await fetch('/api/invitation/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setMessage({ text: '双方绑定成功！同步中...', ok: true })
      await refreshProfiles()
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      setMessage({ text: e.message || '绑定失败', ok: false })
    } finally {
      setIsBinding(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setMessage({ text: '密码长度至少为 6 位', ok: false })
      return
    }
    setIsUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setMessage({ text: '密码设置成功！下次可直接通过密码登录', ok: true })
      setNewPassword('')
    } catch (e: any) {
      setMessage({ text: e.message || '设置失败', ok: false })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  useEffect(() => {
    // 只有在 user 加载完成、确定没有绑定关系、且本次页面生命周期内还没抓取过邀请码时才请求
    if (user && !profile?.couple_id && !hasFetchedInviteCode.current) {
      hasFetchedInviteCode.current = true
      fetchInviteCode()
    }
  }, [user, profile?.couple_id])

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

        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-muted)' }}>账户密码</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="password"
              className="input" 
              placeholder="设置新密码 (至少6位)" 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              style={{ flex: 1 }}
            />
            <button 
              className="btn btn-primary" 
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword || !newPassword}
              style={{ width: '80px', padding: 0, fontSize: '12px' }}
            >
              {isUpdatingPassword ? <RefreshCw className="spin" size={16} /> : '更新'}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            提示：设置密码后，下次登录可不通过邮箱链接直接进入。
          </p>
        </div>

        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-muted)' }}>伙伴绑定</h4>
          
          {profile?.couple_id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', overflow: 'hidden', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {partnerProfile?.avatar_url ? <img src={partnerProfile.avatar_url} style={{ width: '100%' }} /> : <User color="#fff" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '700' }}>已绑定：{partnerProfile?.display_name || '另一半'}</div>
                <div style={{ fontSize: '11px', color: 'var(--green)' }}>空间实时同步中</div>
              </div>
              <Link2 size={16} color="var(--green)" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '14px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>我的邀请码 (24h有效)</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <code style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent)', letterSpacing: '4px' }}>
                    {inviteCode || '......'}
                  </code>
                  <button onClick={() => {
                    navigator.clipboard.writeText(inviteCode)
                    setMessage({ text: '已复制邀请码', ok: true })
                  }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  className="input" 
                  placeholder="输入对方的邀请码" 
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '2px' }}
                />
                <button 
                  className="btn-primary" 
                  onClick={handleJoin}
                  disabled={isBinding || !inputCode}
                  style={{ width: '80px', padding: 0 }}
                >
                  {isBinding ? <RefreshCw className="spin" size={18} /> : '加入'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '600' }}>当前账号</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</p>
          </div>
          <button className="btn-ghost" onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red)' }}>
            <LogOut size={14} /> 退出登录
          </button>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: '32px', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', opacity: 0.5 }}>
        WERE CORD | PREMIUM EXPERIENCE
      </div>
    </div>
  )
}
