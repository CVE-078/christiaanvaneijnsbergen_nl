import type { Metadata } from 'next';
import { login } from './actions';
import SubmitButton from './SubmitButton';

const MONO = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";

export const metadata: Metadata = {
  title: 'Pulse — Login',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const isRateLimited = params.error === 'rate';
  const isWrongPassword = params.error === '1';
  const hasError = isRateLimited || isWrongPassword;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <form action={login} style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff', marginBottom: '0.25rem' }}>
            Pulse<span style={{ color: '#ff6c2f' }}>.</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.06em', color: '#555' }}>
            12-week PPL programme
          </div>
        </div>

        {isRateLimited && (
          <p id="login-error" role="alert" style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.04em', color: '#f97316', marginBottom: '1.25rem' }}>
            Too many attempts. Wait 15 minutes.
          </p>
        )}
        {isWrongPassword && !isRateLimited && (
          <p id="login-error" role="alert" style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.04em', color: '#f43f5e', marginBottom: '1.25rem' }}>
            Incorrect password.
          </p>
        )}

        <label
          htmlFor="password"
          style={{ display: 'block', fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555', marginBottom: '0.5rem' }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? 'login-error' : undefined}
          style={{
            display: 'block',
            width: '100%',
            padding: '0.75rem',
            background: '#141414',
            border: `1px solid ${hasError ? '#f43f5e44' : '#1f1f1f'}`,
            borderRadius: '3px',
            color: '#fff',
            fontFamily: MONO,
            fontSize: '0.9375rem',
            marginBottom: '1rem',
            boxSizing: 'border-box',
          }}
        />

        <SubmitButton />
      </form>
    </div>
  );
}
