'use client'

import React from 'react'

interface SmartTitleProps {
  title?: string
  items?: { name: string }[]
  note?: string
  type: 'gift' | 'aa' | 'insight'
  fontSize?: string
}

export default function SmartTitle({ title, items, note, type, fontSize = '15px' }: SmartTitleProps) {
  // 1. 优先级逻辑判定
  let displayTitle = ''
  
  if (type === 'gift') {
    displayTitle = title || '一笔礼物'
  } else if (type === 'aa') {
    // 优先尝试从 note 中解析我们约定的 [标题 | 备注] 格式
    if (note && note.includes('|')) {
      displayTitle = note.split('|')[0].trim()
    } else if (title) {
      displayTitle = title
    } else if (items && items.length > 0) {
      // 兜底逻辑：拼接所有项目，如果太多则在后面加“等”
      displayTitle = items.map(i => i.name).join('、')
    } else {
      displayTitle = '未命名支出'
    }
  } else {
    displayTitle = title || 'AI 见解'
  }

  return (
    <h3 
      title={displayTitle} // 鼠标悬停显示全称
      style={{ 
        fontSize, 
        fontWeight: '700', 
        marginBottom: '4px',
        color: 'var(--text-primary)',
        // 核心：单行截断逻辑
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        width: '100%',
        display: 'block'
      }}
    >
      {displayTitle}
    </h3>
  )
}
