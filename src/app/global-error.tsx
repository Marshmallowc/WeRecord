'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '40px 20px',
        textAlign: 'center',
        background: '#0f0e0d',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>
          应用遇到了错误
        </h2>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '24px', maxWidth: '400px' }}>
          {error.message || '发生了未知错误，请刷新页面重试'}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 28px',
            borderRadius: '12px',
            background: '#e8956d',
            color: '#fff',
            border: 'none',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          刷新页面
        </button>
      </body>
    </html>
  )
}
