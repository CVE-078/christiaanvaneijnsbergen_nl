import type { Metadata } from 'next';
import { login } from './actions';
import SubmitButton from './SubmitButton';
import { MONO } from '@/lib/weight-tracker/theme';

export const metadata: Metadata = {
    title: 'Pulse — Login',
    robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const params = await searchParams;
    const hasError = params.error === '1';

    const fieldStyle = {
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
        boxSizing: 'border-box' as const,
    };

    const labelStyle = {
        display: 'block',
        fontFamily: MONO,
        fontSize: '0.625rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        color: '#555',
        marginBottom: '0.5rem',
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#0a0a0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
            }}>
            <form action={login} style={{ width: '100%', maxWidth: '360px' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <div
                        style={{
                            fontFamily: MONO,
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: '#fff',
                            marginBottom: '0.25rem',
                        }}>
                        Pulse<span style={{ color: '#ff6c2f' }}>.</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.06em', color: '#555' }}>
                        12-week PPL programme
                    </div>
                </div>

                {hasError && (
                    <p
                        id="login-error"
                        role="alert"
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.6875rem',
                            letterSpacing: '0.04em',
                            color: '#f43f5e',
                            marginBottom: '1.25rem',
                        }}>
                        Invalid email or password.
                    </p>
                )}

                <label htmlFor="email" style={labelStyle}>
                    Email
                </label>
                <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    autoFocus
                    autoComplete="email"
                    aria-invalid={hasError ? true : undefined}
                    aria-describedby={hasError ? 'login-error' : undefined}
                    style={fieldStyle}
                />

                <label htmlFor="password" style={labelStyle}>
                    Password
                </label>
                <input
                    id="password"
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    aria-invalid={hasError ? true : undefined}
                    aria-describedby={hasError ? 'login-error' : undefined}
                    style={fieldStyle}
                />

                <SubmitButton />
            </form>
        </div>
    );
}
