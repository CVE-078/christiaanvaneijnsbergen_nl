'use client';
import { logout } from '@/app/pulse/actions';
import { usePulse } from '@/context/PulseContext';
import OnboardingModal from './OnboardingModal';
import type { View } from '@/lib/pulse/types';

const NAV: { id: View; label: string }[] = [
    { id: 'train', label: 'Train' },
    { id: 'plan', label: 'Plan' },
    { id: 'progress', label: 'Progress' },
    { id: 'profile', label: 'Profile' },
    { id: 'explore', label: 'Explore' },
];

interface Props {
    view: View;
    navigate: (v: View) => void;
    children: React.ReactNode;
}

export default function DesktopLayout({ view, navigate, children }: Props) {
    const { activeWeek, streak, handleExport, showOnboarding } = usePulse();

    return (
        <div className="min-h-screen bg-pulse-bg text-pulse-text flex flex-col">
            {/* Top nav */}
            <header className="sticky top-0 z-50 h-14 border-b border-pulse-border bg-pulse-bg flex items-center gap-2 px-8 shrink-0">
                <span className="font-pulse font-bold text-[0.9375rem] tracking-[0.08em] text-white uppercase mr-1">
                    Pulse<span className="text-pulse-accent">.</span>
                </span>
                <span className="font-pulse text-[0.6875rem] font-bold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 py-[3px] px-2.5 rounded-full tracking-[0.05em] shrink-0">
                    WK {String(activeWeek).padStart(2, '0')}
                </span>
                {streak > 0 && (
                    <span className="font-pulse text-xs font-medium text-pulse-dim shrink-0">{streak}WK</span>
                )}

                {/* Nav links */}
                <nav aria-label="Main navigation" className="flex items-center gap-0.5 ml-auto">
                    {NAV.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => navigate(id)}
                            className={`font-pulse text-[0.875rem] font-semibold px-3.5 py-1.5 rounded-lg border-none cursor-pointer transition-all duration-150 ${
                                view === id
                                    ? 'bg-pulse-accent/10 text-pulse-accent'
                                    : 'bg-transparent text-pulse-dim hover:text-pulse-text hover:bg-white/5'
                            }`}>
                            {label}
                        </button>
                    ))}
                </nav>

                <div className="w-px h-4 bg-pulse-border mx-2 shrink-0" />

                <button
                    onClick={handleExport}
                    aria-label="Export workout logs as JSON"
                    className="font-pulse text-sm text-pulse-dim bg-transparent border-none cursor-pointer hover:text-pulse-text transition-colors">
                    Export
                </button>
                <form action={logout} className="inline">
                    <button
                        type="submit"
                        aria-label="Sign out of Pulse"
                        className="font-pulse text-sm text-pulse-dim bg-transparent border-none cursor-pointer hover:text-pulse-text transition-colors">
                        Sign out
                    </button>
                </form>
            </header>

            <main className="flex-1 overflow-auto">
                {children}
            </main>

            {showOnboarding && <OnboardingModal />}
        </div>
    );
}
