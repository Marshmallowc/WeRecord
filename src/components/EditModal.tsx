'use client'

import { useState, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface EditModalProps {
  record: any
  onClose: () => void
  onSave: (updated: any) => void
  onDelete: (id: string, type: string) => void
  identity: string
  partnerName: string
}

export function EditModal({ record, onClose, onSave, onDelete, identity, partnerName }: EditModalProps) {
  const isGift = record.record_type === 'gift'
  const [formData, setFormData] = useState({ ...record })
  const [categories, setCategories] = useState<{ name: string }[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(res => setCategories(res.data || []))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          type: record.record_type,
          ...formData
        })
      })
      if (res.ok) {
        onSave(formData)
        onClose()
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }} onClick={onClose}>
      <div
        className="premium-card scale-in"
        style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', padding: '24px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>编辑记录</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isGift ? (
            <>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>名称</label>
                <input
                  className="input"
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>金额</label>
                  <input
                    type="number" className="input"
                    value={formData.amount || ''}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>分类</label>
                  <select
                    className="input"
                    value={formData.category || ''}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>支付人</label>
                <select
                  className="input"
                  value={formData.payer || ''}
                  onChange={e => setFormData({ ...formData, payer: e.target.value })}
                >
                  <option value="me">{identity === 'me' ? '我' : partnerName}</option>
                  <option value="her">{identity === 'her' ? '我' : partnerName}</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>总计金额</label>
                <input
                  type="number" className="input"
                  value={formData.total_amount || ''}
                  onChange={e => setFormData({ ...formData, total_amount: parseFloat(e.target.value) })}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>日期</label>
            <input
              type="date" className="input"
              value={formData.date || ''}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>备注</label>
            <textarea
              className="input" rows={2}
              value={isGift ? formData.description : formData.note}
              onChange={e => setFormData({ ...formData, [isGift ? 'description' : 'note']: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, color: 'var(--red)' }}
            onClick={() => {
              if (confirm('确定删除吗？')) {
                onDelete(record.id, record.record_type)
                onClose()
              }
            }}
          >
            <Trash2 size={16} /> 删除
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : (
              <>
                <Save size={16} /> 保存修改
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
