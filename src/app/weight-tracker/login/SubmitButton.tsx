'use client';
import { useFormStatus } from 'react-dom';

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
        background: pending ? '#007a80' : '#00adb5',
        border: 'none',
        borderRadius: '10px',
        color: '#fff',
        fontWeight: 700,
        fontSize: '1rem',
        cursor: pending ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {pending ? 'Entering…' : 'Enter'}
    </button>
  );
}
