import { login } from './actions';
import SubmitButton from './SubmitButton';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const isRateLimited = params.error === 'rate';
  const isWrongPassword = params.error === '1';

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
      <form
        action={login}
        style={{
          background: '#1a1a1a',
          padding: '2rem',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '380px',
        }}
      >
        <h1 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
          Weight Tracker
        </h1>
        <p style={{ color: '#555', fontSize: '0.8125rem', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
          12-week PPL programme
        </p>

        {isRateLimited && (
          <p role="alert" style={{ color: '#f97316', fontSize: '0.875rem', margin: '0 0 1rem' }}>
            Too many attempts. Please wait 15 minutes.
          </p>
        )}
        {isWrongPassword && !isRateLimited && (
          <p role="alert" style={{ color: '#f43f5e', fontSize: '0.875rem', margin: '0 0 1rem' }}>
            Incorrect password. Try again.
          </p>
        )}

        <label
          htmlFor="password"
          style={{ display: 'block', color: '#888', fontSize: '0.75rem', marginBottom: '0.375rem' }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          required
          autoFocus
          style={{
            display: 'block',
            width: '100%',
            padding: '0.75rem',
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '1rem',
            marginBottom: '1.25rem',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <SubmitButton />
      </form>
    </div>
  );
}
