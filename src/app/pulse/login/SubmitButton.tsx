'use client';
import { useFormStatus } from 'react-dom';

const MONO = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";

export default function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        display: 'block',
        width: '100%',
        padding: '0.75rem',
        background: pending ? '#cc5522' : '#ff6c2f',
        border: 'none',
        borderRadius: '3px',
        color: '#fff',
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: '0.75rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: pending ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {pending ? 'Entering…' : 'Enter'}
    </button>
  );
}
