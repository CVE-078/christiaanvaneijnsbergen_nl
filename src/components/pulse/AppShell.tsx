'use client';
import { logout } from '@/app/pulse/actions';
import { usePulse } from '@/context/PulseContext';
import { useMediaQuery } from '@/hooks/pulse/useMediaQuery';
import DesktopLayout from './DesktopLayout';
import RestTimer from './RestTimer';
import LogView from './views/LogView';
import ProgramView from './views/ProgramView';
import HistoryView from './views/HistoryView';
import ProfileView from './views/ProfileView';
import BottomNav from './BottomNav';

export function AppShell() {
    const { activeWeek, streak, view, navigate, handleExport, saveError, timerTrigger } = usePulse();
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    if (isDesktop) {
        return <DesktopLayout />;
    }

    return (
        <div className="min-h-screen bg-pulse-bg text-pulse-text pb-16">
            {/* Simplified topbar — navigation handled by BottomNav */}
            <div className="sticky top-0 z-10 bg-pulse-bg border-b border-pulse-border h-[52px] flex items-center gap-3 px-4">
                <span className="font-pulse font-bold text-[0.9375rem] tracking-[0.08em] text-white uppercase shrink-0">
                    Pulse<span className="text-pulse-accent">.</span>
                </span>
                <span className="font-pulse text-[0.8125rem] font-bold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/20 py-1 px-2.5 rounded-full tracking-[0.04em] shrink-0">
                    WK {String(activeWeek).padStart(2, '0')}
                </span>
                {streak > 0 && (
                    <span className="font-pulse text-sm text-pulse-dim tracking-[0.04em] shrink-0">{streak}WK</span>
                )}
                <div className="ml-auto flex gap-3 items-center">
                    <button
                        onClick={handleExport}
                        aria-label="Export workout logs as JSON"
                        className="font-pulse text-sm text-[#444] bg-transparent border-none cursor-pointer tracking-[0.02em]">
                        Export
                    </button>
                    <form action={logout} className="inline">
                        <button
                            type="submit"
                            aria-label="Sign out of Pulse"
                            className="font-pulse text-sm text-[#444] bg-transparent border-none cursor-pointer tracking-[0.02em]">
                            Sign out
                        </button>
                    </form>
                </div>
            </div>

            {saveError && (
                <div
                    role="alert"
                    className="py-2 px-4 bg-[#f43f5e18] border-b border-[#f43f5e33] text-[#f43f5e] font-pulse text-[0.8125rem] tracking-[0.04em] text-center">
                    {saveError}
                </div>
            )}

            {view === 'log' && <LogView />}
            {view === 'program' && <ProgramView />}
            {view === 'history' && <HistoryView />}
            {view === 'profile' && <ProfileView />}

            {/* Rest timer fixed above bottom nav — avoids layout shift in LogView */}
            <div className="fixed bottom-16 left-0 right-0 z-20 border-t border-pulse-border">
                <RestTimer trigger={timerTrigger} />
            </div>

            <BottomNav view={view} onNavigate={navigate} />
        </div>
    );
}
