'use client';
import { logout } from '@/app/pulse/actions';
import { usePulse } from '@/context/PulseContext';
import { getPhase, getRIR, logKey, parseLogKey, parseMaxSets } from '@/lib/pulse/utils';
import { tabKeyLabel } from '@/lib/pulse/constants';
import { useLocalStorage } from '@/hooks/pulse/useLocalStorage';
import { clearAllSWRCache } from '@/lib/pulse/swrCache';
import OnboardingModal from './OnboardingModal';
import RestTimer from './RestTimer';
import type { RoutineExercise, View } from '@/lib/pulse/types';

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
    {
        id: 'train',
        label: 'Train',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                <path d="M4 9.5v5M7 7v10M17 7v10M20 9.5v5M7 12h10" />
            </svg>
        ),
    },
    {
        id: 'plan',
        label: 'Plan',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                <rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3.2v3.6M16 3.2v3.6" />
            </svg>
        ),
    },
    {
        id: 'progress',
        label: 'Progress',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                <path d="M4 19V9m5 10V5m5 14v-7m5 7V11" />
            </svg>
        ),
    },
    {
        id: 'profile',
        label: 'Profile',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                <circle cx="12" cy="8" r="3.4" />
                <path d="M5 20c1-3.6 4-5 7-5s6 1.4 7 5" />
            </svg>
        ),
    },
    {
        id: 'library',
        label: 'Library',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                <rect x="4" y="4.5" width="5" height="15" rx="1" /><rect x="10" y="4.5" width="5" height="15" rx="1" /><path d="M16.6 6l3.6 1-3 14-3.6-1z" />
            </svg>
        ),
    },
];

interface Props {
    view: View;
    navigate: (v: View) => void;
    children: React.ReactNode;
}

// Count saved sets and total scheduled sets for the active week/tab, and the
// total volume (kg x reps) logged in that session. Used by the right rail.
function computeSessionStats(
    logs: ReturnType<typeof usePulse>['logs'],
    routineExercises: RoutineExercise[],
    week: number,
): { done: number; total: number; volume: number } {
    let total = 0;
    const sessionKeys = new Set<string>();
    for (const re of routineExercises) {
        const maxSets = parseMaxSets(re.sets);
        total += maxSets;
        for (let s = 0; s < maxSets; s++) {
            sessionKeys.add(logKey(week, re.id, s));
        }
    }
    let done = 0;
    let volume = 0;
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved || !sessionKeys.has(key)) continue;
        const parsed = parseLogKey(key);
        if (!parsed || parsed.week !== week) continue;
        done += 1;
        volume += val.kg * val.reps;
    }
    return { done, total, volume };
}

export default function DesktopLayout({ view, navigate, children }: Props) {
    const {
        activeWeek,
        activeTab,
        streak,
        logs,
        routineExercisesByTabKey,
        timerTrigger,
        timerDuration,
        showOnboarding,
        workoutModeOpen,
    } = usePulse();

    const [expanded, setExpanded] = useLocalStorage('pulse:sidebar-expanded', false);

    const phase = getPhase(activeWeek);
    const rir = getRIR(activeWeek);
    const routineExercises: RoutineExercise[] = routineExercisesByTabKey[activeTab] ?? [];
    const { done, total, volume } = computeSessionStats(logs, routineExercises, activeWeek);
    const sessionLabel = tabKeyLabel(activeTab);

    return (
        <div className="flex h-screen bg-pulse-bg text-pulse-text overflow-hidden">
            {/* Left nav rail — collapsible. Collapsed shows the "P" mark + icons;
                expanded shows the full "Pulse" wordmark + labels. Choice persists. */}
            <aside
                className={`shrink-0 border-r border-pulse-border flex flex-col py-7 transition-[width] duration-200 ${
                    expanded ? 'w-[208px] items-stretch px-4 gap-8' : 'w-[74px] items-center gap-9'
                }`}>
                {/* Brand + collapse toggle */}
                <div className={`flex items-center ${expanded ? 'justify-between px-1' : 'flex-col gap-3'}`}>
                    {expanded ? (
                        <span className="font-pulse font-bold text-lg tracking-[0.04em] uppercase text-pulse-text">
                            Pulse<span className="text-pulse-accent">.</span>
                        </span>
                    ) : (
                        <div className="w-[34px] h-[34px] rounded-[10px] bg-pulse-accent grid place-items-center font-pulse font-semibold text-[1.1875rem] text-pulse-bg">
                            P
                        </div>
                    )}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
                        aria-expanded={expanded}
                        title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
                        className="grid place-items-center bg-transparent border-none cursor-pointer text-pulse-muted hover:text-pulse-text transition-colors [&_svg]:w-[18px] [&_svg]:h-[18px]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                            <path
                                d={expanded ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>

                <nav
                    aria-label="Main navigation"
                    className={`flex flex-col ${expanded ? 'gap-1' : 'items-center gap-7'}`}>
                    {NAV.map(({ id, label, icon }) => {
                        const active = view === id;
                        return (
                            <button
                                key={id}
                                onClick={() => navigate(id)}
                                aria-current={active ? 'page' : undefined}
                                aria-label={label}
                                title={label}
                                className={`bg-transparent border-none cursor-pointer transition-colors duration-150 [&_svg]:w-[22px] [&_svg]:h-[22px] [&_svg]:shrink-0 ${
                                    expanded
                                        ? 'flex items-center gap-3 w-full px-2 py-2 rounded-lg font-pulse text-sm'
                                        : 'grid place-items-center'
                                } ${
                                    active
                                        ? `text-pulse-accent${expanded ? ' bg-pulse-accent/10' : ''}`
                                        : 'text-pulse-muted hover:text-pulse-text'
                                }`}>
                                {icon}
                                {expanded && <span>{label}</span>}
                            </button>
                        );
                    })}
                </nav>

                <div className={expanded ? 'mt-auto px-1' : 'mt-auto'}>
                    <form action={logout}>
                        <button
                            type="submit"
                            onClick={() => clearAllSWRCache()}
                            aria-label="Sign out of Pulse"
                            title="Sign out"
                            className={`bg-transparent border-none cursor-pointer text-pulse-muted hover:text-pulse-text transition-colors [&_svg]:w-[22px] [&_svg]:h-[22px] [&_svg]:shrink-0 ${
                                expanded ? 'flex items-center gap-3 font-pulse text-sm' : 'grid place-items-center'
                            }`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <path d="M16 17l5-5-5-5M21 12H9" />
                            </svg>
                            {expanded && <span>Sign out</span>}
                        </button>
                    </form>
                </div>
            </aside>

            {/* Content column */}
            <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>

            {/* Right context rail */}
            <aside className="w-[340px] shrink-0 overflow-y-auto bg-pulse-surface px-8 py-10">
                <h2 className="font-pulse text-xs font-medium tracking-[0.18em] uppercase text-pulse-muted">Today</h2>

                <div className="mt-5">
                    <div className="font-pulse text-[3.25rem] font-medium leading-none tracking-[-0.02em]">
                        {done}
                        <small className="text-lg font-normal text-pulse-muted"> / {total} sets</small>
                    </div>
                    <div className="mt-2 text-[0.8125rem] text-pulse-dim">{sessionLabel} session in progress</div>
                </div>

                <div className="mt-9 flex flex-col gap-6">
                    <div>
                        <div className="text-xs tracking-[0.08em] uppercase text-pulse-muted">Streak</div>
                        <div className="font-pulse text-2xl font-medium mt-1.5 tracking-[-0.01em]">
                            {streak}
                            <span className="font-pulse-body text-[0.8125rem] text-pulse-muted ml-1">
                                {streak === 1 ? 'week' : 'weeks'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs tracking-[0.08em] uppercase text-pulse-muted">Session volume</div>
                        <div className="font-pulse text-2xl font-medium mt-1.5 tracking-[-0.01em]">
                            {volume.toLocaleString()}
                            <span className="font-pulse-body text-[0.8125rem] text-pulse-muted ml-1">kg</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs tracking-[0.08em] uppercase text-pulse-muted">Target intensity</div>
                        <div className="font-pulse text-2xl font-medium mt-1.5 tracking-[-0.01em]">RIR {rir}</div>
                    </div>
                </div>

                {/* Pinned rest timer. Suppressed while guided mode is open so only the
                    WorkoutModeScreen timer counts down (no double beep). */}
                {!workoutModeOpen && (
                    <div className="mt-9">
                        <RestTimer trigger={timerTrigger} duration={timerDuration ?? undefined} />
                    </div>
                )}

                {/* Phase context */}
                <div className="mt-9 text-xs text-pulse-muted tracking-[0.02em]">
                    {phase.label} — {phase.subtitle} · Week {String(activeWeek).padStart(2, '0')}
                </div>
            </aside>

            {showOnboarding && <OnboardingModal />}
        </div>
    );
}
