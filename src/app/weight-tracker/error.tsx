'use client';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WeightTrackerError({ error, reset }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        padding: '1rem',
      }}
    >
      <div style={{ maxWidth: '380px', width: '100%', textAlign: 'center' }}>
        <div style={{ color: '#f43f5e', fontSize: '2rem', marginBottom: '1rem' }}>⚠</div>
        <h2 style={{ color: '#fff', fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Failed to load tracker
        </h2>
        <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          {error.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.625rem 1.5rem',
            background: '#00adb5',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.9375rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
