'use client'

export function RecordSkeleton() {
  return (
    <div className="premium-card" style={{ padding: '16px', marginBottom: '12px', opacity: 0.7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, paddingRight: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <div className="shimmer" style={{ width: '40px', height: '18px', borderRadius: '4px' }} />
            <div className="shimmer" style={{ width: '60px', height: '18px', borderRadius: '4px' }} />
          </div>
          <div className="shimmer" style={{ width: '70%', height: '20px', borderRadius: '4px', marginBottom: '10px' }} />
          <div className="shimmer" style={{ width: '40%', height: '14px', borderRadius: '4px' }} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="shimmer" style={{ width: '60px', height: '24px', borderRadius: '4px', marginBottom: '6px' }} />
          <div className="shimmer" style={{ width: '40px', height: '12px', borderRadius: '4px', marginLeft: 'auto' }} />
        </div>
      </div>
    </div>
  )
}

export function FeedSkeleton() {
  return (
    <div className="fade-in">
      {[1, 2, 3, 4, 5].map(i => (
        <RecordSkeleton key={i} />
      ))}
    </div>
  )
}
