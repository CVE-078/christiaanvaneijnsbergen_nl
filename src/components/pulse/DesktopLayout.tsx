'use client';
import { logout } from '@/app/pulse/actions';
import { usePulse } from '@/context/PulseContext';
import LogViewDesktop from './views/LogViewDesktop';
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

export default function DesktopLayout() {
    const { view, navigate, activeWeek, streak, saveError, handleExport } = usePulse();

    return (
        <div className="flex h-screen overflow-hidden bg-pulse-bg text-pulse-text">
            {/* Sidebar */}
            <aside className="w-44 shrink-0 border-r border-pulse-border flex flex-col overflow-hidden">
                {/* Brand + week */}
                <div className="py-5 px-4 pb-6 border-b border-pulse-border">
                    <div className="font-pulse font-bold text-[0.8125rem] tracking-[0.08em] text-white uppercase">
                        Pulse<span className="text-pulse-accent">.</span>
                    </div>
                    <div className="font-pulse text-xs text-pulse-dim mt-2.5">
                        WK{' '}
                        <strong className="text-pulse-accent font-bold">{String(activeWeek).padStart(2, '0')}</strong> /
                        12
                    </div>
                    {streak > 0 && (
                        <div className="font-pulse text-[0.625rem] text-[#444] mt-1 tracking-[0.04em]">
                            {streak}WK streak
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav aria-label="Main navigation" className="flex-1 flex flex-col gap-0.5 p-2">
                    {NAV.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => navigate(id)}
                            className={`font-pulse text-[0.8125rem] text-left py-2 px-3.5 rounded-[3px] border-none border-l-2 cursor-pointer tracking-[0.02em] w-full ${
                                view === id
                                    ? 'font-bold text-white bg-[#1a1a1a] border-pulse-accent'
                                    : 'font-normal text-pulse-dim bg-transparent border-transparent'
                            }`}>
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Utilities */}
                <div className="py-3 px-2 border-t border-pulse-border flex flex-col gap-0.5">
                    <button
                        onClick={handleExport}
                        className="font-pulse text-xs text-[#444] bg-transparent border-none border-l-2 border-transparent text-left py-2 px-3.5 cursor-pointer tracking-[0.02em] w-full">
                        Export
                    </button>
                    <form action={logout} className="block">
                        <button
                            type="submit"
                            className="font-pulse text-xs text-[#444] bg-transparent border-none border-l-2 border-transparent text-left py-2 px-3.5 cursor-pointer tracking-[0.02em] w-full">
                            Sign out
                        </button>
                    </form>
                </div>
            </aside>

            {/* Content */}
            <main className={`flex-1 flex flex-col overflow-hidden ${view !== 'log' ? 'overflow-auto' : ''}`}>
                {saveError && (
                    <div
                        role="alert"
                        className="py-2 px-4 bg-[#f43f5e18] border-b border-[#f43f5e33] text-[#f43f5e] font-pulse text-[0.6875rem] tracking-[0.04em] text-center shrink-0">
                        {saveError}
                    </div>
                )}
                <div className={`flex-1 ${view === 'log' ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
                    {view === 'log' && <LogViewDesktop />}
                    {view === 'program' && <ProgramView />}
                    {view === 'history' && <HistoryView />}
                    {view === 'profile' && <ProfileView />}
                </div>
            </main>
        </div>
    );
}
