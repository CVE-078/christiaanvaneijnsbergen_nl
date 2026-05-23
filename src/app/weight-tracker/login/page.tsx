import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { error } = await searchParams;

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
        <h1 style={{ color: '#fff', marginBottom: '0.25rem', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
          Weight Tracker
        </h1>
        <p style={{ color: '#555', fontSize: '0.8125rem', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
          12-week PPL programme
        </p>

        {error && (
          <p style={{ color: '#f43f5e', fontSize: '0.875rem', marginBottom: '1rem', margin: '0 0 1rem' }}>
            Incorrect password. Try again.
          </p>
        )}

        <label style={{ display: 'block', color: '#888', fontSize: '0.75rem', marginBottom: '0.375rem' }}>
          Password
        </label>
        <input
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

        <button
          type="submit"
          style={{
            display: 'block',
            width: '100%',
            padding: '0.75rem',
            background: '#00adb5',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Enter
        </button>
      </form>
    </div>
  );
}
