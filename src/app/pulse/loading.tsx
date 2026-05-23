export default function Loading() {
  const mono = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1f1f1f', padding: '0 1rem', height: 56, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.08em', color: '#fff', textTransform: 'uppercase' }}>
          Pulse<span style={{ color: '#ff6c2f' }}>.</span>
        </div>
        <div style={{ height: '0.75rem', width: '5rem', background: '#1f1f1f', borderRadius: '3px', marginLeft: '0.5rem' }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.25rem' }}>
          {['Log', 'Program', 'History'].map(l => (
            <div key={l} style={{ height: '0.75rem', width: '3.5rem', background: '#1f1f1f', borderRadius: '3px' }} />
          ))}
        </div>
      </div>
      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #1f1f1f', display: 'flex' }}>
        {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: '2.75rem', background: i === 1 ? '#141414' : 'transparent' }} />)}
      </div>
      {/* Week row */}
      <div style={{ height: '2.25rem', borderBottom: '1px solid #1f1f1f', background: '#0a0a0a' }} />
      {/* Cards */}
      <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ height: '2.5rem', background: '#141414', borderRadius: '4px', marginBottom: '0.75rem' }} />
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '4rem', background: '#141414', border: '1px solid #1f1f1f', borderRadius: '4px', marginBottom: '0.25rem' }} />
        ))}
      </div>
    </div>
  );
}
