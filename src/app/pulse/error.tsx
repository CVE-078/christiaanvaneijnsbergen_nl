'use client';
import Link from 'next/link';
import { MONO } from '@/lib/pulse/theme';

interface Props {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function PulseError({ error, reset }: Props) {
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
            <div role="alert" style={{ maxWidth: '380px', width: '100%', textAlign: 'center' }}>
                <div
                    style={{
                        fontFamily: MONO,
                        fontSize: '0.6875rem',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#f43f5e',
                        marginBottom: '1rem',
                    }}>
                    Error
                </div>
                <p style={{ color: '#555', fontSize: '0.875rem', marginBottom: '0.75rem', fontFamily: MONO }}>
                    Failed to load. Please try again.
                </p>
                {error.digest && (
                    <p
                        style={{
                            color: '#333',
                            fontSize: '0.625rem',
                            fontFamily: MONO,
                            letterSpacing: '0.04em',
                            marginBottom: '2rem',
                        }}>
                        Code: {error.digest}
                    </p>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={reset}
                        style={{
                            padding: '0.625rem 1.5rem',
                            background: 'transparent',
                            border: '1px solid #ff6c2f',
                            borderRadius: '3px',
                            color: '#ff6c2f',
                            fontFamily: MONO,
                            fontSize: '0.75rem',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                        }}>
                        Try again
                    </button>
                    <Link
                        href="/"
                        style={{
                            padding: '0.625rem 1.5rem',
                            background: 'transparent',
                            border: '1px solid #2a2a2a',
                            borderRadius: '3px',
                            color: '#555',
                            fontFamily: MONO,
                            fontSize: '0.75rem',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                        }}>
                        ← Back
                    </Link>
                </div>
            </div>
        </div>
    );
}
