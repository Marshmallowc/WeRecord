'use client'

export default function Loading() {
  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="shimmer" style={{ width: '100%', height: '140px', borderRadius: '16px', marginBottom: '24px' }} />
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div className="shimmer" style={{ flex: 1, height: '40px', borderRadius: '8px' }} />
        <div className="shimmer" style={{ width: '100px', height: '40px', borderRadius: '8px' }} />
        <div className="shimmer" style={{ width: '100px', height: '40px', borderRadius: '8px' }} />
      </div>
      <div className="shimmer" style={{ width: '100px', height: '20px', marginBottom: '16px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="premium-card" style={{ padding: '16px', height: '100px' }}>
            <div className="shimmer" style={{ width: '60%', height: '14px', marginBottom: '10px' }} />
            <div className="shimmer" style={{ width: '40%', height: '10px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
