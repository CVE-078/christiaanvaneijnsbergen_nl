'use client';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/pulse/actions';
import { MONO, ACCENT, BG, BORDER, DIM } from '@/lib/pulse/theme';
import { usePulse } from '@/context/PulseContext';
import LogView from './views/LogView';
import ProgramView from './views/ProgramView';
import HistoryView from './views/HistoryView';
import ProfileView from './views/ProfileView';
import type { View } from '@/lib/pulse/types';

const NAV: { id: View; label: string }[] = [
    { id: 'log', label: 'Log' },
    { id: 'program', label: 'Program' },
    { id: 'history', label: 'History' },
    { id: 'profile', label: 'Profile' },
];

export function AppShell() {
    const { activeWeek, streak, view, navigate, handleExport, saveError } = usePulse();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        function onPointerDown(e: PointerEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [menuOpen]);

    const hamburgerLineStyle = {
        display: 'block',
        width: '18px',
        height: '1.5px',
        background: DIM,
        borderRadius: '1px',
        transition: 'transform 0.2s, opacity 0.2s',
    };

    function handleNavigate(v: View) {
        navigate(v);
        setMenuOpen(false);
    }

    return (
        <div style={{ minHeight: '100vh', background: BG, color: '#d4d4d4' }}>
            {/* Header */}
            <div ref={menuRef} style={{ position: 'sticky', top: 0, zIndex: 10, background: BG }}>
                <div
                    style={{
                        borderBottom: `1px solid ${menuOpen ? 'transparent' : BORDER}`,
                        padding: '0 1rem',
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                    }}>
                    <span
                        style={{
                            fontFamily: MONO,
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            letterSpacing: '0.08em',
                            color: '#fff',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                        }}>
                        Pulse<span style={{ color: ACCENT }}>.</span>
                    </span>
                    <span
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.75rem',
                            color: DIM,
                            letterSpacing: '0.05em',
                            flexShrink: 0,
                        }}>
                        WK{' '}
                        <strong style={{ color: ACCENT, fontWeight: 700 }}>
                            {String(activeWeek).padStart(2, '0')}
                        </strong>{' '}
                        / 12
                    </span>
                    {streak > 0 && (
                        <span
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.6875rem',
                                color: '#555',
                                letterSpacing: '0.05em',
                                flexShrink: 0,
                            }}>
                            · {streak}WK
                        </span>
                    )}
                    <nav
                        style={{ marginLeft: 'auto', display: 'flex', gap: '1.25rem', alignItems: 'center' }}
                        aria-label="Main navigation">
                        <span className="pulse-desktop-nav">
                            {NAV.map(({ id, label }) => {
                                const active = view === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleNavigate(id)}
                                        style={{
                                            fontFamily: MONO,
                                            fontSize: '0.8125rem',
                                            fontWeight: 500,
                                            color: active ? '#fff' : DIM,
                                            background: 'none',
                                            border: 'none',
                                            borderBottom: active ? `1px solid ${ACCENT}` : '1px solid transparent',
                                            paddingBottom: '1px',
                                            cursor: 'pointer',
                                            letterSpacing: '0.02em',
                                        }}>
                                        {label}
                                    </button>
                                );
                            })}
                            <span style={{ color: '#2a2a2a', paddingBottom: '1px' }}>|</span>
                            <button
                                onClick={handleExport}
                                aria-label="Export workout logs as JSON"
                                style={{
                                    fontFamily: MONO,
                                    fontSize: '0.8125rem',
                                    fontWeight: 500,
                                    color: DIM,
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: '1px solid transparent',
                                    paddingBottom: '1px',
                                    cursor: 'pointer',
                                    letterSpacing: '0.02em',
                                }}>
                                Export
                            </button>
                            <form action={logout} style={{ display: 'inline' }}>
                                <button
                                    type="submit"
                                    aria-label="Sign out of Pulse"
                                    style={{
                                        fontFamily: MONO,
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        color: '#444',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        letterSpacing: '0.02em',
                                        paddingBottom: '1px',
                                    }}>
                                    Sign out
                                </button>
                            </form>
                        </span>
                        <button
                            className="pulse-hamburger"
                            onClick={() => setMenuOpen((o) => !o)}
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={menuOpen}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                flexDirection: 'column',
                                gap: '4px',
                                flexShrink: 0,
                            }}>
                            <span style={{ ...hamburgerLineStyle, transform: menuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none' }} />
                            <span style={{ ...hamburgerLineStyle, opacity: menuOpen ? 0 : 1 }} />
                            <span style={{ ...hamburgerLineStyle, transform: menuOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none' }} />
                        </button>
                    </nav>
                </div>

                {menuOpen && (
                    <div
                        style={{
                            borderBottom: `1px solid ${BORDER}`,
                            padding: '0.5rem 0 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                        }}>
                        {NAV.map(({ id, label }) => {
                            const active = view === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleNavigate(id)}
                                    style={{
                                        fontFamily: MONO,
                                        fontSize: '0.9375rem',
                                        fontWeight: active ? 700 : 400,
                                        color: active ? '#fff' : DIM,
                                        background: 'none',
                                        border: 'none',
                                        borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
                                        textAlign: 'left',
                                        padding: '0.75rem 1.25rem',
                                        cursor: 'pointer',
                                        letterSpacing: '0.02em',
                                    }}>
                                    {label}
                                </button>
                            );
                        })}
                        <div style={{ height: '1px', background: '#1a1a1a', margin: '0.25rem 1rem' }} />
                        <button
                            onClick={() => { handleExport(); setMenuOpen(false); }}
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.875rem',
                                color: DIM,
                                background: 'none',
                                border: 'none',
                                borderLeft: '2px solid transparent',
                                textAlign: 'left',
                                padding: '0.75rem 1.25rem',
                                cursor: 'pointer',
                                letterSpacing: '0.02em',
                            }}>
                            Export
                        </button>
                        <form action={logout}>
                            <button
                                type="submit"
                                style={{
                                    fontFamily: MONO,
                                    fontSize: '0.875rem',
                                    color: '#444',
                                    background: 'none',
                                    border: 'none',
                                    borderLeft: '2px solid transparent',
                                    textAlign: 'left',
                                    padding: '0.75rem 1.25rem',
                                    cursor: 'pointer',
                                    letterSpacing: '0.02em',
                                    width: '100%',
                                }}>
                                Sign out
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {saveError && (
                <div
                    role="alert"
                    style={{
                        padding: '0.5rem 1rem',
                        background: '#f43f5e18',
                        borderBottom: '1px solid #f43f5e33',
                        color: '#f43f5e',
                        fontFamily: MONO,
                        fontSize: '0.6875rem',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                    }}>
                    {saveError}
                </div>
            )}

            {view === 'log' && <LogView />}
            {view === 'program' && <ProgramView />}
            {view === 'history' && <HistoryView />}
            {view === 'profile' && <ProfileView />}
        </div>
    );
}
