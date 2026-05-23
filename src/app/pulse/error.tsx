'use client';

const MONO = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PulseError({ error, reset }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ maxWidth: '380px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f43f5e', marginBottom: '1rem' }}>
          Error
        </div>
        <p style={{ color: '#555', fontSize: '0.875rem', marginBottom: '2rem', fontFamily: MONO }}>
          {error.message ?? 'Failed to load.'}
        </p>
        <button
          onClick={reset}
          style={{ padding: '0.625rem 1.5rem', background: 'transparent', border: '1px solid #ff6c2f', borderRadius: '3px', color: '#ff6c2f', fontFamily: MONO, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
