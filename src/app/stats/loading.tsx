'use client'

export default function Loading() {
  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="shimmer" style={{ width: '120px', height: '28px', borderRadius: '4px', marginBottom: '24px' }} />
      <div className="glass" style={{ height: '50px', borderRadius: '14px', marginBottom: '24px' }} />
      <div className="premium-card shimmer" style={{ height: '180px', marginBottom: '20px' }} />
      <div className="premium-card" style={{ padding: '24px' }}>
        <div className="shimmer" style={{ width: '100px', height: '20px', marginBottom: '24px' }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ marginBottom: '20px' }}>
            <div className="shimmer" style={{ width: '100%', height: '12px', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
