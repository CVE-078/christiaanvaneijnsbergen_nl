import { MONO, BG, SURFACE, BORDER, ACCENT } from '@/lib/weight-tracker/theme';

const shimmer: React.CSSProperties = {
  background: `linear-gradient(90deg, #141414 25%, #1c1c1c 50%, #141414 75%)`,
  backgroundSize: '200% 100%',
  animation: 'pulse-shimmer 1.4s ease infinite',
};

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#d4d4d4' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '0 1rem', height: 56, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.08em', color: '#fff', textTransform: 'uppercase' }}>
          Pulse<span style={{ color: ACCENT }}>.</span>
        </span>
        <div style={{ width: 60, height: 12, borderRadius: 2, ...shimmer }} />
        <div style={{ marginLeft: 'auto', width: 160, height: 12, borderRadius: 2, ...shimmer }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
        {['Push', 'Pull', 'Legs'].map(label => (
          <div key={label} style={{ flex: 1, padding: '0.875rem 0', textAlign: 'center', fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#333' }}>
            {label}
          </div>
        ))}
      </div>

      {/* Week row */}
      <div style={{ display: 'flex', padding: '0 1rem', borderBottom: `1px solid ${BORDER}`, gap: '0.25rem' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ minWidth: '2.25rem', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 10, borderRadius: 2, ...shimmer }} />
          </div>
        ))}
      </div>

      {/* Exercise card skeletons */}
      <div style={{ padding: '0.75rem 1rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 36, height: 28, borderRadius: 2, ...shimmer }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: `${55 + i * 7}%`, height: 12, borderRadius: 2, marginBottom: 8, ...shimmer }} />
              <div style={{ width: '40%', height: 8, borderRadius: 2, ...shimmer }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
