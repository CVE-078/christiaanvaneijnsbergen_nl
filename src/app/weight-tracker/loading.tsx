export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header skeleton */}
      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ height: '1rem', width: '6rem', background: '#1a1a1a', borderRadius: '4px' }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '1.75rem', width: '4.5rem', background: '#1a1a1a', borderRadius: '20px' }} />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ flex: 1, height: '2.5rem', background: '#1a1a1a', borderRadius: '10px' }} />
          ))}
        </div>
        {/* Banner */}
        <div style={{ height: '3rem', background: '#1a1a1a', borderRadius: '10px', marginBottom: '1rem' }} />
        {/* Cards */}
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{ height: '4rem', background: '#1a1a1a', borderRadius: '10px', marginBottom: '0.5rem' }} />
        ))}
      </div>
    </div>
  );
}
