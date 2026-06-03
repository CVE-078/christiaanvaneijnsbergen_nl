'use client';
import { useEffect, useState } from 'react';
import { logout } from '@/app/pulse/actions';
import { clearAllSWRCache } from '@/lib/pulse/swrCache';
import { usePulse } from '@/context/PulseContext';
import { useMediaQuery } from '@/hooks/pulse/useMediaQuery';
import DesktopLayout from './DesktopLayout';
import RestTimer from './RestTimer';
import BottomNav from './BottomNav';
import OnboardingModal from './OnboardingModal';
import PageSkeleton from './PageSkeleton';
import type { View } from '@/lib/pulse/types';

export function AppShell({
    view,
    navigate,
    children,
}: {
    view: View;
    navigate: (v: View) => void;
    children: React.ReactNode;
}) {
    const { activeWeek, streak, handleExport, timerTrigger, timerDuration, showOnboarding } = usePulse();
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Render exactly one shell. Previously both trees were mounted via CSS
    // show/hide, which double-mounted the view, the rest timer, and the
    // onboarding modal (two timers, two stacked modals, every view hook running
    // twice). Gate on `mounted` so SSR and the first client render agree (both
    // skeleton) and there is no hydration mismatch; AppShell mounts once per
    // session, so this costs at most one skeleton frame on a hard load and never
    // on client navigation.
    if (!mounted) {
        return (
            <div className="min-h-screen bg-pulse-bg">
                <PageSkeleton />
            </div>
        );
    }

    if (isDesktop) {
        return (
            <DesktopLayout view={view} navigate={navigate}>
                {children}
            </DesktopLayout>
        );
    }

    return (
        <div className="min-h-screen bg-pulse-bg text-pulse-text pb-16">
            {/* Simplified topbar — navigation handled by BottomNav */}
            <div className="sticky top-0 z-10 bg-pulse-bg h-[52px] flex items-center gap-3 px-4">
                <span className="font-pulse font-medium text-[1.375rem] tracking-[-0.01em] text-pulse-text shrink-0">
                    Pulse<span className="text-pulse-accent">.</span>
                </span>
                <span className="font-pulse text-[0.8125rem] font-semibold text-pulse-accent tracking-[0.04em] shrink-0">
                    WK {String(activeWeek).padStart(2, '0')}
                </span>
                {streak > 0 && (
                    <span className="font-pulse-body text-[0.8125rem] text-pulse-dim tracking-[0.04em] shrink-0">
                        {streak}WK
                    </span>
                )}
                <div className="ml-auto flex gap-3 items-center">
                    <button
                        onClick={handleExport}
                        aria-label="Export workout logs as JSON"
                        className="font-pulse-body text-[0.8125rem] text-pulse-dim bg-transparent border-none cursor-pointer tracking-[0.02em]">
                        Export
                    </button>
                    <form action={logout} className="inline">
                        <button
                            type="submit"
                            onClick={() => clearAllSWRCache()}
                            aria-label="Sign out of Pulse"
                            className="font-pulse-body text-[0.8125rem] text-pulse-dim bg-transparent border-none cursor-pointer tracking-[0.02em]">
                            Sign out
                        </button>
                    </form>
                </div>
            </div>

            {/* Page content comes from routing */}
            <div className="pb-16">{children}</div>

            {/* Rest timer fixed above bottom nav — avoids layout shift in LogView */}
            <div className="fixed bottom-16 left-0 right-0 z-20">
                <RestTimer trigger={timerTrigger} duration={timerDuration ?? undefined} />
            </div>

            {showOnboarding && <OnboardingModal />}
            <BottomNav view={view} onNavigate={navigate} />
        </div>
    );
}
