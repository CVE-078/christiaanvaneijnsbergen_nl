'use client';
import { logout } from '@/app/pulse/actions';
import { usePulse } from '@/context/PulseContext';
import OnboardingModal from './OnboardingModal';
import RestTimer from './RestTimer';
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
    const { activeWeek, streak, activeRoutine, timerTrigger, timerDuration, showOnboarding } = usePulse();

    return (
        <div className="flex h-screen bg-pulse-bg text-pulse-text overflow-hidden">
            {/* Sidebar */}
            <aside className="w-[180px] border-r border-pulse-border bg-pulse-bg flex flex-col shrink-0 py-5 px-3">
                {/* Logo + week badge */}
                <div className="flex items-center gap-2 px-2 mb-6">
                    <span className="font-pulse font-bold text-[0.9375rem] tracking-[0.08em] text-white uppercase">
                        Pulse<span className="text-pulse-accent">.</span>
                    </span>
                    <span className="font-pulse text-[0.625rem] font-bold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 py-[3px] px-2 rounded-full tracking-[0.05em]">
                        WK {String(activeWeek).padStart(2, '0')}
                    </span>
                </div>

                {/* Nav links */}
                <nav aria-label="Main navigation" className="flex flex-col gap-0.5">
                    {NAV.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => navigate(id)}
                            className={`font-pulse text-[0.875rem] font-semibold text-left px-3 py-2 rounded-lg border-none cursor-pointer transition-all duration-150 ${
                                view === id
                                    ? 'bg-pulse-accent/10 text-pulse-accent'
                                    : 'bg-transparent text-pulse-dim hover:text-pulse-text hover:bg-white/5'
                            }`}>
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Streak */}
                {streak > 0 && (
                    <div className="px-3 mb-2">
                        <span className="font-pulse text-xs text-pulse-dim">{streak}WK</span>
                    </div>
                )}

                {/* Context card */}
                <div className="bg-pulse-surface border border-pulse-border rounded-xl p-3 mb-3">
                    {activeRoutine ? (
                        <>
                            <div className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-muted mb-1">
                                Active Routine
                            </div>
                            <div className="font-pulse text-[0.8125rem] text-pulse-text font-medium leading-snug">
                                {activeRoutine.name}
                            </div>
                        </>
                    ) : (
                        <div className="font-pulse text-[0.75rem] text-pulse-dim">No routine</div>
                    )}
                </div>

                {/* Sign out */}
                <form action={logout} className="px-1">
                    <button
                        type="submit"
                        aria-label="Sign out of Pulse"
                        className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer hover:text-pulse-text transition-colors w-full text-left px-2 py-1">
                        Sign out
                    </button>
                </form>
            </aside>

            {/* Content column */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto">{children}</main>
                <RestTimer trigger={timerTrigger} duration={timerDuration ?? undefined} />
            </div>

            {showOnboarding && <OnboardingModal />}
        </div>
    );
}
