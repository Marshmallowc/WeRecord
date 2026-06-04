'use client'

import { useEffect, useRef, useState } from 'react'
import { useIdentity } from '@/context/IdentityContext'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import EmbeddedRecordsList from '@/components/EmbeddedRecordsList'
import { Send, Sparkles, User, Trash2, ArrowDown, Paperclip } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AAItem {
  name: string
  amount: number
  category: string
}

interface MockRecord {
  id: string
  record_type: 'gift' | 'aa'
  date: string
  title?: string
  total_amount?: number
  my_share?: number
  amount?: number
  payer?: string
  from_user?: string
  to_user?: string
  status?: 'pending' | 'settled'
  note?: string
  aa_items?: AAItem[]
  category?: string
}

interface Message {
  id: string
  sender: 'user' | 'assistant'
  role?: 'user' | 'assistant'
  text: string
  timestamp: string
  records?: MockRecord[]
  image_urls?: string[]
}

export default function AIAssistantPage() {
  const { identity, partnerName, displayName, avatarUrl, partnerAvatarUrl } = useIdentity()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `你好 ${displayName}！我是你的情侣财务助理 **Mason**。我会帮你随时翻阅账本、快速录账或平账，你可以随时向我查询有无漏记，或者让我做任何账务操作。
你可以试着问我以下问题，或者点击下方快捷键：`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)

  // Local Image Upload States
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTo({
        top: chatHistoryRef.current.scrollHeight,
        behavior
      })
    }
  }

  // Auto scroll on new messages
  useEffect(() => {
    scrollToBottom('smooth')
  }, [messages, isTyping])

  // Track scroll position to show/hide the scroll-to-bottom helper button
  const handleScroll = () => {
    const el = chatHistoryRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    setShowScrollDown(!isNearBottom)
  }

  const suggestions = [
    '昨天吃火锅记账了吗？',
    '上个月我们电影花了多少？',
    '帮我记一笔：咖啡 25元 AA',
    '提醒对方平账'
  ]

  const handleSend = async (textToSend: string, imageUrls: string[] = []) => {
    const trimmedText = textToSend.trim()
    if (!trimmedText && imageUrls.length === 0) return
    if (isTyping) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      role: 'user',
      text: trimmedText || '上传并分析账单图片',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    // Temporarily render image previews on user's chat bubble
    if (imageUrls.length > 0) {
      userMsg.image_urls = imageUrls
    }

    const currentHistory = [...messages, userMsg]
    setMessages(currentHistory)
    setInputText('')
    setIsTyping(true)

    try {
      // Connect to real backend Agent Endpoint
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentHistory.map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          })),
          image_urls: imageUrls
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Server error')

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        role: 'assistant',
        text: data.text || '没有返回文本见解。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        records: data.records
      }

      setMessages(prev => [...prev, aiMsg])
    } catch (err: any) {
      console.error('[AI Assistant Chat] Error:', err)
      showToast(err.message || 'AI 助手服务异常，请稍后再试。', false)
      
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        role: 'assistant',
        text: '对不起，管家 **Mason** 刚才开小差了，请检查网络或配置后再试。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
    }
  }

  // Handle image compression and uploads before sending message
  const handleSendWithImages = async () => {
    if (isTyping || uploadingImages) return

    let imageUrls: string[] = []

    if (selectedImages.length > 0) {
      setUploadingImages(true)
      try {
        for (const file of selectedImages) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
          const filePath = `records/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('record_images')
            .upload(filePath, file)

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('record_images')
            .getPublicUrl(filePath)

          imageUrls.push(publicUrl)
        }
      } catch (err: any) {
        console.error('Failed to upload records image(s):', err)
        showToast('图片上传失败，请稍后重试。', false)
        setUploadingImages(false)
        return
      }
    }

    setUploadingImages(false)
    setSelectedImages([])
    await handleSend(inputText, imageUrls)
  }

  // Confirm and Save Draft record to Database
  const handleConfirmDraft = async (draftId: string, record: any) => {
    // 1. Optimistic UI update - mark draft as saved
    setMessages(prev =>
      prev.map(msg => {
        if (msg.records) {
          return {
            ...msg,
            records: msg.records.map(r => r.id === draftId ? { ...r, is_draft: false } : r)
          }
        }
        return msg
      })
    )

    try {
      // 2. Call backend /api/save to execute insertion
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: identity,
          items: [
            {
              type: record.record_type,
              source_text: record.source_text || "AI 助理录入",
              result: {
                payer: record.payer,
                total: record.total_amount || record.amount,
                my_share: record.my_share,
                note: record.note,
                title: record.title,
                date: record.date,
                category: record.category,
                image_urls: record.image_urls || [],
                items: record.aa_items?.map((i: any) => ({
                  name: i.name,
                  amount: i.amount,
                  category: i.category
                })) || []
              }
            }
          ]
        })
      })

      if (!res.ok) throw new Error('API save failed')
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to save')

      showToast('已成功记入账本，主页数据实时同步中。')
    } catch (err: any) {
      console.error('Failed to save draft:', err)
      showToast('保存失败，请稍后重试', false)

      // Revert card state back to draft
      setMessages(prev =>
        prev.map(msg => {
          if (msg.records) {
            return {
              ...msg,
              records: msg.records.map(r => r.id === draftId ? { ...r, is_draft: true } : r)
            }
          }
          return msg
        })
      )
    }
  }

  // Cancel and Discard draft
  const handleDiscardDraft = (draftId: string) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.records) {
          return {
            ...msg,
            records: msg.records.filter(r => r.id !== draftId)
          }
        }
        return msg
      })
    )
    showToast('记账草稿已取消')
  }

  // Handle local and remote settlement toggle in UI
  const handleSettle = async (recordId: string, totalAmount: number, myShare: number, aaItems: any[]) => {
    // 1. Optimistic update
    setMessages(prev =>
      prev.map(msg => {
        if (msg.records) {
          return {
            ...msg,
            records: msg.records.map(r => r.id === recordId ? { ...r, status: 'settled' } : r)
          }
        }
        return msg
      })
    )

    try {
      // 2. Perform the PATCH request
      const res = await fetch('/api/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recordId, type: 'aa', status: 'settled' }),
      })
      if (!res.ok) throw new Error('API settlement failed')

      // 3. Trigger partner nudge/notification
      const isMe = identity === 'me'
      const targetIdentity = isMe ? 'her' : 'me'
      const amount = identity === 'me' ? (myShare || 0) : ((totalAmount || 0) - (myShare || 0))
      const billName = aaItems?.map((i: any) => i.name).join('、') || '一笔账单'

      fetch('/api/push/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetIdentity,
          title: '✅ 账单已结清',
          body: `Ta 已经支付了「${billName}」的 ${amount}元，记得查收哦~`,
          url: '/'
        })
      }).catch(err => console.error('Failed to notify partner', err))

      showToast('账单已结清，主页数据将实时同步更新。')
    } catch (err) {
      showToast('结清失败，请稍后重试。', false)
      // Revert status
      setMessages(prev =>
        prev.map(msg => {
          if (msg.records) {
            return {
              ...msg,
              records: msg.records.map(r => r.id === recordId ? { ...r, status: 'pending' } : r)
            }
          }
          return msg
        })
      )
    }
  }

  // Handle nudge action
  const handleNudge = async (record: any) => {
    const isMe = identity === 'me'
    const targetIdentity = isMe ? 'her' : 'me'
    const name = record.aa_items?.map((i: any) => i.name).join('、') || '一笔账单'
    const amount = targetIdentity === 'her'
      ? (record.total_amount! - (record.my_share || 0))
      : (record.my_share || 0)

    try {
      showToast('正在向 Ta 发送提醒...')
      const res = await fetch('/api/push/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetIdentity,
          title: '💸 记账提醒',
          body: `嘿~ 你的亲亲提醒你有一笔 [${name}] 的账单待结清 (${amount}元) 哦`,
          url: '/'
        })
      })
      const data = await res.json()
      if (data.success && data.count > 0) {
        showToast('已成功通过手机通知提醒 Ta')
      } else {
        showToast('Ta 的手机通知未开启或订阅已过期。', false)
      }
    } catch (e) {
      showToast('发送提醒失败。', false)
    }
  }

  return (
    <div className="chat-container">
      {/* Background radial ambient lights */}
      <div className="ambient-glow" />

      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '0', right: '0', margin: '0 auto',
          width: 'max-content', maxWidth: '90%',
          padding: '10px 24px', borderRadius: '100px', fontSize: '13px', fontWeight: '600',
          background: toast.ok ? 'var(--green)' : 'var(--red)', color: '#fff',
          zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Chat Header Status Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 0 12px 0', borderBottom: '1px solid var(--border)',
        zIndex: 2
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '10px',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)'
          }}>
            <img src="/ai-avatar.svg" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              理财助理 Mason
            </h2>
            <p style={{ fontSize: '9px', color: 'var(--green)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', margin: 0 }}>
              <span style={{ display: 'inline-block', width: '5px', height: '5px', background: 'var(--green)', borderRadius: '50%' }} />
              智能 AI 大脑在线
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setMessages([
              {
                id: 'welcome',
                sender: 'assistant',
                text: `你好 ${displayName}！我是你的情侣财务助理 **Mason**。我会帮你随时翻阅账本、快速录账或平账，你可以随时向我查询有无漏记，或者让我做任何账务操作。
你可以试着问我以下问题，或者点击下方快捷键：`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ])
            showToast('会话历史已清空')
          }}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          title="清空会话"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Messages Feed Area */}
      <div className="chat-history" ref={chatHistoryRef} onScroll={handleScroll} style={{ position: 'relative' }}>
        {messages.map((msg) => {
          const isUser = msg.sender === 'user'
          return (
            <div key={msg.id} className={`message-wrapper ${isUser ? 'user' : 'assistant'}`}>
              <div style={{ display: 'flex', gap: '8px', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                {/* User/AI Avatars */}
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px', overflow: 'hidden',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)', flexShrink: 0
                }}>
                  {isUser ? (
                    avatarUrl ? <img src={avatarUrl} alt="Me" style={{ width: '100%', height: '100%' }} /> : <User size={14} style={{ padding: '7px' }} />
                  ) : (
                    <img src="/ai-avatar.svg" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>

                {/* Speech Bubble Column */}
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <div className="message-bubble">
                    {/* Render message text with our new custom MarkdownRenderer */}
                    <MarkdownRenderer content={msg.text} />

                    {/* Inline Image Attachments inside Bubble */}
                    {msg.image_urls && msg.image_urls.length > 0 && (
                      <div 
                        className="no-scrollbar"
                        style={{ 
                          display: 'flex', 
                          gap: '6px', 
                          marginTop: '8px', 
                          overflowX: 'auto', 
                          paddingBottom: '4px',
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none'
                        }}
                      >
                        {msg.image_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            <img
                              src={url}
                              alt="attachment"
                              style={{ 
                                width: '64px', 
                                height: '64px', 
                                borderRadius: '8px', 
                                objectFit: 'cover', 
                                border: '1px solid rgba(255,255,255,0.15)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                              }}
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Rich Interactive Cards Group with folding logic */}
                    {msg.records && msg.records.length > 0 && (
                      <EmbeddedRecordsList
                        records={msg.records}
                        identity={identity}
                        partnerName={partnerName}
                        onSettle={handleSettle}
                        onNudge={handleNudge}
                        onConfirmDraft={handleConfirmDraft}
                        onDiscardDraft={handleDiscardDraft}
                      />
                    )}
                  </div>
                  <span className="message-meta">{msg.timestamp}</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Typing Indicator dots */}
        {isTyping && (
          <div className="message-wrapper assistant">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)'
              }}>
                <img src="/ai-avatar.svg" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="message-bubble">
                <div className="typing-dots">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating Scroll Down Helper */}
        {showScrollDown && (
          <button
            onClick={() => scrollToBottom('smooth')}
            style={{
              position: 'absolute', bottom: '12px', right: '12px',
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(26,25,23,0.85)', backdropFilter: 'blur(10px)',
              border: '1px solid var(--border)', color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 5, boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            <ArrowDown size={14} />
          </button>
        )}
      </div>

      {/* Suggestion Pills */}
      <div className="suggestions-scroll">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            className="suggestion-pill"
            onClick={() => handleSend(s)}
            disabled={isTyping}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Bottom Chat Input capsule */}
      <div 
        className="chat-input-bar" 
        style={{
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 0,
          padding: 0,
          borderRadius: '24px',
          overflow: 'hidden'
        }}
      >
        {/* Selected Local Image Previews inside the capsule */}
        {selectedImages.length > 0 && (
          <div 
            className="no-scrollbar"
            style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              padding: '14px 16px 10px 16px',
              borderBottom: '1px solid var(--border)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              background: 'rgba(0, 0, 0, 0.05)'
            }}
          >
            {selectedImages.map((file, i) => {
              const previewUrl = URL.createObjectURL(file)
              return (
                <div 
                  key={i} 
                  className="scale-in"
                  style={{ 
                    position: 'relative', 
                    width: '56px', 
                    height: '56px', 
                    flexShrink: 0,
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  <img 
                    src={previewUrl} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      borderRadius: '12px', 
                      objectFit: 'cover', 
                      border: '1px solid rgba(255, 255, 255, 0.08)' 
                    }} 
                  />
                  <button
                    onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}
                    style={{
                      position: 'absolute', 
                      top: '-6px', 
                      right: '-6px',
                      width: '18px', 
                      height: '18px', 
                      borderRadius: '50%',
                      background: 'var(--red)', 
                      color: '#fff', 
                      fontSize: '11px',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: '1.5px solid var(--bg-card)', 
                      cursor: 'pointer', 
                      fontWeight: 'bold',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Input Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 6px 6px 14px' }}>
          {/* Hidden File Input */}
          <input
            type="file"
            ref={imageInputRef}
            multiple
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length + selectedImages.length > 9) {
                showToast('最多选择 9 张图片', false)
                return
              }
              setSelectedImages(prev => [...prev, ...files])
            }}
          />

          {/* Paperclip Button */}
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={isTyping || uploadingImages}
            style={{
              background: 'transparent', border: 'none', 
              color: selectedImages.length > 0 ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '6px', marginRight: '2px', transition: 'color 0.2s',
              outline: 'none'
            }}
            title="上传收据/消费图片 (支持 1~9 张)"
          >
            <Paperclip size={18} />
          </button>

          <input
            className="input"
            style={{
              flex: 1, border: 'none', background: 'transparent',
              padding: '4px 6px', fontSize: '14px', height: '32px',
              boxShadow: 'none'
            }}
            placeholder={uploadingImages ? "正在上传收据图片..." : "发送消息，或上传 1~9 张图片分析记账..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendWithImages()
              }
            }}
            disabled={isTyping || uploadingImages}
          />
          <button
            onClick={handleSendWithImages}
            disabled={(!inputText.trim() && selectedImages.length === 0) || isTyping || uploadingImages}
            className="btn-primary"
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, flexShrink: 0, 
              opacity: (!inputText.trim() && selectedImages.length === 0) || isTyping || uploadingImages ? 0.5 : 1,
              boxShadow: '0 2px 8px rgba(232, 149, 109, 0.3)'
            }}
          >
            {uploadingImages ? (
              <div className="spin" style={{ width: '12px', height: '12px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
            ) : (
              <Send size={14} style={{ marginLeft: '1px' }} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
