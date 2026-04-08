'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px 20px',
      textAlign: 'center',
      background: 'var(--bg-primary, #0f0e0d)',
      color: 'var(--text-primary, #fff)',
    }}>
      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>
        出了点问题
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary, rgba(255,255,255,0.6))', marginBottom: '24px', maxWidth: '400px' }}>
        {error.message || '页面加载时发生了未知错误'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '12px 28px',
          borderRadius: '12px',
          background: 'var(--accent, #e8956d)',
          color: '#fff',
          border: 'none',
          fontSize: '15px',
          fontWeight: '700',
          cursor: 'pointer',
        }}
      >
        重试
      </button>
    </div>
  )
}
