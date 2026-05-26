'use client';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/pulse/actions';
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

    function handleNavigate(v: View) {
        navigate(v);
        setMenuOpen(false);
    }

    return (
        <div className="min-h-screen bg-pulse-bg text-pulse-text">
            {/* Header */}
            <div ref={menuRef} className="sticky top-0 z-10 bg-pulse-bg">
                <div
                    className={`px-4 h-14 flex items-center gap-3 border-b ${menuOpen ? 'border-transparent' : 'border-pulse-border'}`}>
                    <span className="font-pulse font-bold text-[0.8125rem] tracking-[0.08em] text-white uppercase shrink-0">
                        Pulse<span className="text-pulse-accent">.</span>
                    </span>
                    <span className="font-pulse text-xs text-pulse-dim tracking-[0.05em] shrink-0">
                        WK{' '}
                        <strong className="text-pulse-accent font-bold">{String(activeWeek).padStart(2, '0')}</strong> /
                        12
                    </span>
                    {streak > 0 && (
                        <span className="font-pulse text-[0.6875rem] text-[#555] tracking-[0.05em] shrink-0">
                            · {streak}WK
                        </span>
                    )}
                    <nav className="ml-auto flex gap-5 items-center" aria-label="Main navigation">
                        {/* Desktop nav — hidden on mobile, shown as contents on sm+ */}
                        <span className="hidden sm:contents">
                            {NAV.map(({ id, label }) => {
                                const active = view === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleNavigate(id)}
                                        className={`font-pulse text-[0.8125rem] font-medium bg-transparent border-none border-b pb-px cursor-pointer tracking-[0.02em] ${active ? 'text-white border-pulse-accent' : 'text-pulse-dim border-transparent'}`}>
                                        {label}
                                    </button>
                                );
                            })}
                            <span className="text-[#2a2a2a] pb-px">|</span>
                            <button
                                onClick={handleExport}
                                aria-label="Export workout logs as JSON"
                                className="font-pulse text-[0.8125rem] font-medium text-pulse-dim bg-transparent border-none border-b border-transparent pb-px cursor-pointer tracking-[0.02em]">
                                Export
                            </button>
                            <form action={logout} className="inline">
                                <button
                                    type="submit"
                                    aria-label="Sign out of Pulse"
                                    className="font-pulse text-xs font-medium text-[#444] bg-transparent border-none cursor-pointer tracking-[0.02em] pb-px">
                                    Sign out
                                </button>
                            </form>
                        </span>
                        {/* Hamburger — shown on mobile, hidden on sm+ */}
                        <button
                            className="flex flex-col gap-1 sm:hidden bg-transparent border-none cursor-pointer p-1 shrink-0"
                            onClick={() => setMenuOpen((o) => !o)}
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={menuOpen}>
                            {/* transform is runtime state — must stay inline */}
                            <span
                                className="block w-[18px] h-[1.5px] bg-pulse-dim rounded-sm transition-transform duration-200"
                                style={{ transform: menuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none' }}
                            />
                            <span
                                className="block w-[18px] h-[1.5px] bg-pulse-dim rounded-sm transition-opacity duration-200"
                                style={{ opacity: menuOpen ? 0 : 1 }}
                            />
                            <span
                                className="block w-[18px] h-[1.5px] bg-pulse-dim rounded-sm transition-transform duration-200"
                                style={{ transform: menuOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none' }}
                            />
                        </button>
                    </nav>
                </div>

                {menuOpen && (
                    <div className="border-b border-pulse-border py-2 pb-3 flex flex-col">
                        {NAV.map(({ id, label }) => {
                            const active = view === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleNavigate(id)}
                                    className={`font-pulse text-[0.9375rem] bg-transparent border-none border-l-2 text-left py-3 px-5 cursor-pointer tracking-[0.02em] ${active ? 'font-bold text-white border-pulse-accent' : 'font-normal text-pulse-dim border-transparent'}`}>
                                    {label}
                                </button>
                            );
                        })}
                        <div className="h-px bg-[#1a1a1a] mx-4 my-1" />
                        <button
                            onClick={() => {
                                handleExport();
                                setMenuOpen(false);
                            }}
                            className="font-pulse text-[0.875rem] text-pulse-dim bg-transparent border-none border-l-2 border-transparent text-left py-3 px-5 cursor-pointer tracking-[0.02em]">
                            Export
                        </button>
                        <form action={logout}>
                            <button
                                type="submit"
                                className="font-pulse text-[0.875rem] text-[#444] bg-transparent border-none border-l-2 border-transparent text-left py-3 px-5 cursor-pointer tracking-[0.02em] w-full">
                                Sign out
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {saveError && (
                <div
                    role="alert"
                    className="py-2 px-4 bg-[#f43f5e18] border-b border-[#f43f5e33] text-[#f43f5e] font-pulse text-[0.6875rem] tracking-[0.04em] text-center">
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
