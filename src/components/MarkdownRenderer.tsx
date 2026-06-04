import React from 'react'

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null

  // Helper to parse inline styles like bold (**text**)
  const parseInlineStyles = (text: string): React.ReactNode[] => {
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g)
    return parts.map((part, index) => {
      // Every odd index was surrounded by **
      if (index % 2 === 1) {
        return <strong key={index} style={{ fontWeight: '800', color: 'var(--text-primary)' }}>{part}</strong>
      }
      return part
    })
  }

  // Parse lines to handle bullet lists and normal blocks
  const lines = content.split('\n')
  const renderedElements: React.ReactNode[] = []
  let currentListItems: React.ReactNode[] = []

  const flushList = (key: number) => {
    if (currentListItems.length > 0) {
      renderedElements.push(
        <ul 
          key={`list-${key}`} 
          style={{ 
            paddingLeft: '20px', 
            margin: '8px 0', 
            listStyleType: 'disc',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          {currentListItems}
        </ul>
      )
      currentListItems = []
    }
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()

    // Bullet points (matches lines starting with '- ' or '* ')
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const listContent = trimmedLine.substring(2)
      currentListItems.push(
        <li key={`li-${index}`} style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
          {parseInlineStyles(listContent)}
        </li>
      )
    } else {
      // If we encounter a non-list item, flush any existing list items
      flushList(index)

      if (trimmedLine === '') {
        // Render spacing for double line breaks
        renderedElements.push(<div key={`space-${index}`} style={{ height: '8px' }} />)
      } else {
        // Render standard paragraph block
        renderedElements.push(
          <p 
            key={`p-${index}`} 
            style={{ 
              margin: '4px 0', 
              fontSize: '14.5px', 
              lineHeight: '1.6',
              color: 'inherit'
            }}
          >
            {parseInlineStyles(line)}
          </p>
        )
      }
    }
  })

  // Flush any trailing list items
  flushList(lines.length)

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{renderedElements}</div>
}
