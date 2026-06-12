'use client';
import { useEffect, useMemo, useState } from 'react';
import {
    toDisplay,
    computeE1RMHistory,
    swapKey,
    parseLogKey,
    computeStrengthByWeek,
    computeRecompSignal,
    computeRecoveryFlags,
    priorityAdjustedTargets,
    priorityFocusLine,
    recoverySummaryWord,
    weekInBlock,
} from '@/lib/pulse/utils';
import { resolvePriority } from '@/lib/pulse/generation';
import { computeHistoryBundle } from '@/lib/pulse/historyBundle';
import { usePulse } from '@/context/PulseContext';
import VolumeChart from '@/components/pulse/VolumeChart';
import E1RMChart from '@/components/pulse/E1RMChart';
import BestLifts from '@/components/pulse/BestLifts';
import MuscleVolumeBars from '@/components/pulse/MuscleVolumeBars';
import RecompCard from '@/components/pulse/RecompCard';
import ProgramStatusCard from '@/components/pulse/ProgramStatusCard';
import CoachActivityTimeline from '@/components/pulse/CoachActivityTimeline';
import StrengthBreakdownModal from '@/components/pulse/StrengthBreakdownModal';
import PageTitle from '@/components/pulse/PageTitle';
import { computeStrengthScore } from '@/lib/pulse/strength';
import PageSkeleton, { ErrorState } from '@/components/pulse/PageSkeleton';
import { VOLUME_TARGETS } from '@/lib/pulse/data';
import SegmentedTabs from '@/components/pulse/SegmentedTabs';
import BodyWeightCard from '@/components/pulse/BodyWeightCard';
import GoalWeightCard from '@/components/pulse/GoalWeightCard';
import MeasurementsCard from '@/components/pulse/MeasurementsCard';
import RecentChangeCard from '@/components/pulse/RecentChangeCard';
import SessionsCalendar from '@/components/pulse/SessionsCalendar';
import SessionDetailModal from '@/components/pulse/SessionDetailModal';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import { formatLogDate } from '@/lib/pulse/dates';
import { assembleWorkouts, type Workout } from '@/lib/pulse/workouts';
import type { Logs, WorkoutSession, WorkoutType } from '@/lib/pulse/types';

type ProgressTab = 'overview' | 'lifts' | 'body';

const PROGRESS_TABS: { id: ProgressTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'lifts', label: 'Lifts' },
    { id: 'body', label: 'Body' },
];

// Dashboard time window. 'cycle' is the current 12-week program (default), 'all'
// is every logged week (distinct once data spans multiple cycles), 'week' zooms
// the period-based widgets to the active week. Strength Score and Personal
// Records stay all-time regardless, they are lifetime records, not trends.
type ProgressWindow = 'week' | 'cycle' | 'all';

const WINDOW_LABELS: Record<ProgressWindow, string> = { week: 'Week', cycle: 'Cycle', all: 'All' };

function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="font-pulse text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-pulse-muted mb-[9px]">
            {children}
        </div>
    );
}

// Inline goal-weight summary used in the Body panel's 50% summary row.
// Matches the mockup's .goalrow layout: Current -> arrow -> Goal (accent) -> To go.
// When no goal is set, falls back to the GoalWeightCard's edit form.
function GoalWeightSummary() {
    const { profile, bodyweightLogs } = usePulse();
    const { unit } = profile;
    const current = bodyweightLogs[0]?.weight_kg ?? null;
    const goal = profile.goal_weight_kg ?? null;

    if (!goal) {
        return <GoalWeightCard />;
    }

    const toGo = current !== null ? toDisplay(Math.abs(current - goal), unit) : null;
    const currentDisplay = current !== null ? toDisplay(current, unit) : null;
    const goalDisplay = toDisplay(goal, unit);

    // Progress bar: percentage of the initial gap already closed. Without a
    // persisted start weight we use the first logged entry as the baseline.
    const firstLog = bodyweightLogs[bodyweightLogs.length - 1]?.weight_kg ?? null;
    const startDisplay = firstLog !== null ? toDisplay(firstLog, unit) : null;
    let progressPct = 0;
    if (startDisplay !== null && currentDisplay !== null && startDisplay !== goalDisplay) {
        progressPct = Math.min(
            100,
            Math.max(
                0,
                Math.round(((startDisplay - currentDisplay) / (startDisplay - goalDisplay)) * 100),
            ),
        );
    }

    return (
        <div>
            <div className="flex items-center gap-4 flex-wrap">
                <div>
                    <div className="font-pulse text-[0.6rem] tracking-[0.08em] uppercase text-pulse-muted">Current</div>
                    <div className="font-pulse-display font-semibold text-[1.45rem] leading-none mt-1">
                        {currentDisplay !== null ? currentDisplay.toFixed(1) : '—'}
                        <span className="font-pulse text-[0.82rem] text-pulse-muted ml-1">{unit}</span>
                    </div>
                </div>
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-pulse-muted shrink-0"
                    aria-hidden>
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                </svg>
                <div>
                    <div className="font-pulse text-[0.6rem] tracking-[0.08em] uppercase text-pulse-muted">Goal</div>
                    <div className="font-pulse-display font-semibold text-[1.45rem] leading-none mt-1 text-pulse-accent">
                        {goalDisplay.toFixed(1)}
                        <span className="font-pulse text-[0.82rem] text-pulse-accent/60 ml-1">{unit}</span>
                    </div>
                </div>
                <div className="ml-auto text-right">
                    <div className="font-pulse text-[0.6rem] tracking-[0.08em] uppercase text-pulse-muted">To go</div>
                    <div className="font-pulse-display font-semibold text-[1.45rem] leading-none mt-1">
                        {toGo !== null ? toGo.toFixed(1) : '—'}
                        <span className="font-pulse text-[0.82rem] text-pulse-muted ml-1">{unit}</span>
                    </div>
                </div>
            </div>
            <div className="mt-[14px] h-2 rounded-full bg-pulse-bg overflow-hidden">
                <div className="h-full rounded-full bg-pulse-accent" style={{ width: `${progressPct}%` }} />
            </div>
        </div>
    );
}

// "Show all workouts" modal: bottom-sheet on mobile, centered on desktop.
// Groups workouts by month, each row opens the session detail modal.
function AllWorkoutsModal({
    open,
    workouts,
    todayIso,
    onClose,
    onSelectWorkout,
}: {
    open: boolean;
    workouts: Workout[];
    todayIso: string;
    unit: string;
    onClose: () => void;
    onSelectWorkout: (w: Workout) => void;
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    // Group workouts by YYYY-MM (newest month first).
    const groups: { key: string; label: string; items: Workout[] }[] = [];
    for (const w of workouts) {
        const monthKey = w.date.slice(0, 7);
        let g = groups.find((x) => x.key === monthKey);
        if (!g) {
            const d = new Date(w.date);
            const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            g = { key: monthKey, label, items: [] };
            groups.push(g);
        }
        g.items.push(w);
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="All workouts"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center"
            onClick={onClose}>
            <div
                className="flex w-full max-w-[560px] max-h-[86vh] flex-col rounded-t-[20px] bg-pulse-surface pb-5 lg:max-h-[78vh] lg:rounded-[18px] lg:mx-6"
                onClick={(e) => e.stopPropagation()}>
                {/* Grip handle, visible on mobile only */}
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-pulse-border lg:hidden" aria-hidden />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-3 pb-3">
                    <span className="font-pulse-display font-bold text-[1.3rem] text-pulse-text leading-tight">
                        All Workouts
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="cursor-pointer border-none bg-transparent font-pulse text-[1.05rem] leading-none text-pulse-muted hover:text-pulse-text">
                        &#x2715;
                    </button>
                </div>

                {/* Month-grouped workout list */}
                <div className="overflow-y-auto px-6 pb-1 flex-1">
                    {groups.map((group) => (
                        <div key={group.key}>
                            <div className="sticky top-0 z-10 bg-pulse-surface pt-3 pb-2 flex items-center gap-3">
                                <span className="font-pulse text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-pulse-muted">
                                    {group.label}
                                </span>
                                <span className="h-px flex-1 bg-pulse-border" />
                                <span className="font-pulse text-[0.64rem] text-pulse-muted shrink-0">
                                    {group.items.length} {group.items.length === 1 ? 'workout' : 'workouts'}
                                </span>
                            </div>
                            {group.items.map((w) => {
                                const label =
                                    (WORKOUT_TYPE_LABELS[w.workoutType as WorkoutType] ?? w.workoutType) +
                                    (w.variant ? ` ${w.variant}` : '');
                                const dateIso = w.date.split('T')[0];
                                return (
                                    <button
                                        key={w.id}
                                        type="button"
                                        onClick={() => onSelectWorkout(w)}
                                        className="w-full flex items-center justify-between border-b border-pulse-border py-[12px] last:border-b-0 text-left cursor-pointer bg-transparent border-x-0 border-t-0 hover:opacity-80 transition-opacity">
                                        <div>
                                            <span className="font-pulse text-[0.9rem] text-pulse-text block">
                                                {label}
                                            </span>
                                            <span className="font-pulse text-[0.75rem] text-pulse-muted mt-[2px] block">
                                                {formatLogDate(dateIso, todayIso)} · {w.setCount} sets
                                            </span>
                                        </div>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-pulse-muted shrink-0">
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    {workouts.length === 0 && (
                        <p className="py-6 text-center font-pulse text-sm text-pulse-muted">No workouts yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function HistoryView() {
    const {
        logs,
        profile,
        prMap,
        routines,
        streak,
        activeWeek,
        activeRoutine,
        loading,
        errors,
        retry,
        swaps,
        exercises,
        bodyweightLogs,
        bodyMeasurements,
        workoutSessions,
        programPosition,
        decisions,
    } = usePulse();
    const unit = profile.unit;

    // Time window for the period-based widgets (volume, e1RM, recomp trend,
    // session history). 'cycle' (weeks 1-12) is the default and matches the
    // prior behaviour; 'week' zooms to the active week; 'all' is every week.
    const [progressWindow, setProgressWindow] = useState<ProgressWindow>('cycle');
    const windowedLogs = useMemo<Logs>(() => {
        if (progressWindow === 'all') return logs;
        const out: Logs = {};
        for (const [key, val] of Object.entries(logs)) {
            const parsed = parseLogKey(key);
            if (!parsed) continue;
            const inWindow =
                progressWindow === 'week' ? parsed.week === activeWeek : parsed.week >= 1 && parsed.week <= 12;
            if (inWindow) out[key] = val;
        }
        return out;
    }, [logs, progressWindow, activeWeek]);

    const recomp = useMemo(
        () =>
            computeRecompSignal({
                bodyweight: bodyweightLogs,
                measurements: bodyMeasurements,
                strengthByWeek: computeStrengthByWeek(windowedLogs),
            }),
        [bodyweightLogs, bodyMeasurements, windowedLogs],
    );

    const allRoutineExercises = useMemo(() => routines.flatMap((r) => r.exercises), [routines]);

    const nameMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const re of allRoutineExercises) m.set(re.id, re.exercise.name);
        return m;
    }, [allRoutineExercises]);

    const exerciseNameById = useMemo(() => {
        const m = new Map<string, string>();
        for (const e of exercises) m.set(e.id, e.name);
        return m;
    }, [exercises]);

    const activeRoutineExercises = useMemo(() => activeRoutine?.exercises ?? [], [activeRoutine]);

    const strength = useMemo(
        () =>
            computeStrengthScore({
                gender: profile.gender,
                bodyweightKg: bodyweightLogs[0]?.weight_kg ?? null,
                lifts: Object.entries(prMap).map(([rid, e1rm]) => ({ name: nameMap.get(rid) ?? '', e1rm })),
            }),
        [prMap, nameMap, bodyweightLogs, profile.gender],
    );

    // One pass over logs replacing the former five independent scans
    // (buildHistory, computeVolumeByTypeAndWeek, computeBestSets,
    // computePerMuscleVolume, default-exercise scan).
    const { sessions, volByWeek, bestSets, muscleVolume, defaultExerciseId } = useMemo(
        () => computeHistoryBundle(windowedLogs, allRoutineExercises, activeRoutineExercises, activeWeek),
        [windowedLogs, allRoutineExercises, activeRoutineExercises, activeWeek],
    );

    // Weekly volume targets, tilted toward the user's muscle priority so the
    // recovery/volume nudges match a routine generated under that priority.
    const targets = useMemo(
        () => priorityAdjustedTargets(VOLUME_TARGETS, resolvePriority(profile.priority_muscle)),
        [profile.priority_muscle],
    );
    // Plain-language caption explaining the priority tilt above the volume bars
    // (null when the user has no priority, so nothing renders).
    const focusLine = useMemo(
        () => priorityFocusLine(resolvePriority(profile.priority_muscle)),
        [profile.priority_muscle],
    );

    // Same routine-exercise list and week that produce muscleVolume above, so
    // recovery flags align 1:1 with the volume rows.
    const recovery = useMemo(
        () => computeRecoveryFlags(logs, activeRoutineExercises, activeWeek, targets),
        [logs, activeRoutineExercises, activeWeek, targets],
    );

    const recoverySummary = useMemo(() => recoverySummaryWord(recovery), [recovery]);

    // Real workouts assembled from workout_sessions + set_logs via session_id.
    // nameFor applies per-week swap resolution identical to the old sessionCardRows logic.
    const workouts = useMemo(
        () =>
            assembleWorkouts(workoutSessions, logs, (reId, week) => {
                const subId = swaps[swapKey(week, reId)];
                if (subId) return exerciseNameById.get(subId) ?? nameMap.get(reId) ?? '—';
                return nameMap.get(reId) ?? '—';
            }),
        [workoutSessions, logs, swaps, exerciseNameById, nameMap],
    );

    const [strengthModalOpen, setStrengthModalOpen] = useState(false);
    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
    const exerciseId = selectedExerciseId ?? defaultExerciseId;

    const e1rmHistory = useMemo(
        () => (exerciseId ? computeE1RMHistory(windowedLogs, exerciseId) : []),
        [windowedLogs, exerciseId],
    );

    const hasData = sessions.length > 0;

    // Active progress tab (Overview / Lifts / Body). No persistence; defaults to Overview.
    const [progressTab, setProgressTab] = useState<ProgressTab>('overview');

    // Session detail modal: shows a single Workout.
    const [detailWorkout, setDetailWorkout] = useState<Workout | null>(null);

    // "Show all workouts" modal.
    const [allWorkoutsOpen, setAllWorkoutsOpen] = useState(false);

    // Current month/year for the sessions calendar, with prev/next navigation.
    const calendarNow = useMemo(() => new Date(), []);
    const [calendarYear, setCalendarYear] = useState(() => calendarNow.getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(() => calendarNow.getMonth());

    // Shift the calendar by whole months, rolling the year over via Date math.
    // (Avoids calling one setter inside another's updater, which double-fired
    // the year under React strict mode.)
    function shiftMonth(delta: number) {
        const d = new Date(calendarYear, calendarMonth + delta, 1);
        setCalendarYear(d.getFullYear());
        setCalendarMonth(d.getMonth());
    }

    // Open the detail modal for the workout matching a calendar day's session.
    function openCalendarSession(s: WorkoutSession) {
        const found = workouts.find((w) => w.id === s.id);
        if (found) setDetailWorkout(found);
    }

    // Today string for formatLogDate calls.
    const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

    if (errors?.routines || errors?.logs) return <ErrorState onRetry={retry} />;
    if (loading?.routines || loading?.logs) return <PageSkeleton />;

    return (
        <div className="px-4 pt-5 pb-12 mx-auto w-full max-w-[600px] lg:max-w-[1000px] lg:px-6 lg:pt-6 lg:pb-12">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                <PageTitle>Progress</PageTitle>
                <div className="flex items-center gap-3">
                    <span className="font-pulse-body text-[0.8125rem] text-pulse-muted tracking-[0.03em]">
                        {streak === 0 ? 'No streak yet' : `${streak}-week streak`}
                    </span>
                    <div
                        className="inline-flex bg-pulse-surface-2 rounded-lg p-0.5 gap-0.5"
                        role="group"
                        aria-label="Time window">
                        {(['week', 'cycle', 'all'] as const).map((w) => (
                            <button
                                key={w}
                                onClick={() => setProgressWindow(w)}
                                aria-pressed={progressWindow === w}
                                className={`font-pulse text-[0.6875rem] font-semibold tracking-[0.04em] py-1 px-2.5 rounded-md cursor-pointer border-none ${progressWindow === w ? 'bg-pulse-accent text-pulse-bg' : 'bg-transparent text-pulse-dim'}`}>
                                {WINDOW_LABELS[w]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab switcher */}
            <div className="mb-6">
                <SegmentedTabs
                    tabs={PROGRESS_TABS}
                    active={progressTab}
                    onChange={(id) => setProgressTab(id as ProgressTab)}
                    ariaLabel="Progress sections"
                    variant="solid"
                />
            </div>

            {/* Overview panel */}
            {progressTab === 'overview' && (
                <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
                    {/* Metric strip: 4 glanceable tiles */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
                        {/* Strength tile, tappable to open the breakdown modal */}
                        <button
                            type="button"
                            onClick={() => setStrengthModalOpen(true)}
                            className="flex flex-col items-center rounded-2xl bg-pulse-surface p-3.5 border border-transparent hover:border-pulse-border transition-colors cursor-pointer">
                            <span className="font-pulse-display font-bold text-[1.85rem] leading-none text-pulse-accent">
                                {strength.score ?? '—'}
                            </span>
                            <span className="font-pulse text-[0.6rem] tracking-[0.09em] uppercase text-pulse-muted mt-1.5">
                                Strength &rsaquo;
                            </span>
                        </button>
                        {/* Recovery tile */}
                        <div className="flex flex-col items-center rounded-2xl bg-pulse-surface p-3.5">
                            <span className="font-pulse-display font-bold text-[1.85rem] leading-none text-pulse-text">
                                {recoverySummary}
                            </span>
                            <span className="font-pulse text-[0.6rem] tracking-[0.09em] uppercase text-pulse-muted mt-1.5">
                                Recovery
                            </span>
                        </div>
                        {/* Program tile */}
                        <div className="flex flex-col items-center rounded-2xl bg-pulse-surface p-3.5">
                            <span className="font-pulse-display font-bold text-[1.85rem] leading-none text-pulse-text">
                                {programPosition
                                    ? `W${weekInBlock(programPosition.weekInteger, activeRoutine?.program_weeks ?? 12)}`
                                    : '—'}
                            </span>
                            <span className="font-pulse text-[0.6rem] tracking-[0.09em] uppercase text-pulse-muted mt-1.5">
                                Program
                            </span>
                        </div>
                        {/* Streak tile */}
                        <div className="flex flex-col items-center rounded-2xl bg-pulse-surface p-3.5">
                            <span className="font-pulse-display font-bold text-[1.85rem] leading-none text-pulse-text">
                                {streak}
                            </span>
                            <span className="font-pulse text-[0.6rem] tracking-[0.09em] uppercase text-pulse-muted mt-1.5">
                                Streak (wk)
                            </span>
                        </div>
                    </div>

                    {/* Program status card */}
                    <div className="mb-4">
                        <SectionHeader>Program</SectionHeader>
                        <ProgramStatusCard />
                    </div>

                    {/* Recomp verdict card */}
                    <div className="mb-4">
                        <SectionHeader>Recomp verdict</SectionHeader>
                        <RecompCard readout={recomp} unit={unit} lengthUnit={profile.length_unit} />
                    </div>

                    {/* Coach activity timeline, only when the coach has acted */}
                    {decisions.length > 0 && (
                        <div>
                            <SectionHeader>Coach activity</SectionHeader>
                            <CoachActivityTimeline />
                        </div>
                    )}

                    {/* Strength breakdown modal */}
                    <StrengthBreakdownModal
                        open={strengthModalOpen}
                        strength={strength}
                        onClose={() => setStrengthModalOpen(false)}
                    />
                </div>
            )}

            {/* Lifts panel */}
            {progressTab === 'lifts' && (
                <div id="panel-lifts" role="tabpanel" aria-labelledby="tab-lifts">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* e1RM Progression */}
                        <div className="bg-pulse-surface rounded-2xl p-5">
                            {/* Chart label row */}
                            <div className="flex items-baseline justify-between mb-[7px]">
                                <SectionHeader>e1RM progression</SectionHeader>
                                {allRoutineExercises.length > 0 && (
                                    <select
                                        aria-label="Exercise"
                                        value={exerciseId ?? ''}
                                        onChange={(e) => setSelectedExerciseId(e.target.value || null)}
                                        className="font-pulse text-[0.6875rem] bg-pulse-surface-2 rounded-lg px-2 py-[4px] text-pulse-dim border-none cursor-pointer -mt-0.5">
                                        {allRoutineExercises.map((re) => (
                                            <option key={re.id} value={re.id}>
                                                {re.exercise.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            {/* Value readout: current e1RM + delta vs first */}
                            {e1rmHistory.length > 0 && (() => {
                                const last = e1rmHistory[e1rmHistory.length - 1];
                                const first = e1rmHistory[0];
                                const currentE1RM = toDisplay(last.e1rm, unit);
                                const deltaPct = first.e1rm > 0
                                    ? Math.round(((last.e1rm - first.e1rm) / first.e1rm) * 100)
                                    : null;
                                return (
                                    <div className="flex items-baseline gap-1.5 mb-[7px]">
                                        <span className="font-pulse font-semibold text-[0.86rem] text-pulse-text">
                                            {currentE1RM} {unit}
                                        </span>
                                        {deltaPct !== null && (
                                            <span className={`font-pulse text-[0.74rem] font-medium ${deltaPct >= 0 ? 'text-pulse-success' : 'text-pulse-dim'}`}>
                                                {deltaPct >= 0 ? '+' : ''}{deltaPct}% / {e1rmHistory.length} wk
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}
                            <E1RMChart history={e1rmHistory} unit={unit} />
                        </div>

                        {/* Weekly Volume */}
                        <div className="bg-pulse-surface rounded-2xl p-5">
                            <SectionHeader>Weekly volume</SectionHeader>
                            {/* Value readout: current week total sets */}
                            {(() => {
                                const weekSets = volByWeek[activeWeek];
                                const totalSets = weekSets
                                    ? Object.values(weekSets).reduce((s, v) => s + (v ?? 0), 0)
                                    : 0;
                                return (
                                    <div className="flex items-baseline gap-1.5 mb-[7px]">
                                        <span className="font-pulse font-semibold text-[0.86rem] text-pulse-text">
                                            {totalSets} sets
                                        </span>
                                        <span className="font-pulse text-[0.74rem] text-pulse-muted">this week</span>
                                    </div>
                                );
                            })()}
                            {hasData ? (
                                <VolumeChart volByWeek={volByWeek} currentWeek={activeWeek} />
                            ) : (
                                <p className="font-pulse text-[0.75rem] text-pulse-dim py-4">
                                    Log a session to see volume trends.
                                </p>
                            )}
                        </div>

                        {/* Per-muscle volume this week */}
                        <div className="bg-pulse-surface rounded-2xl p-5">
                            <SectionHeader>Volume by muscle, Week {activeWeek}</SectionHeader>
                            {focusLine && (
                                <p className="-mt-1 mb-3 font-pulse text-[0.75rem] text-pulse-accent">{focusLine}</p>
                            )}
                            <MuscleVolumeBars volume={muscleVolume} targets={targets} />
                        </div>

                        {/* Best Lifts */}
                        <div className="bg-pulse-surface rounded-2xl p-5">
                            <SectionHeader>Best Lifts</SectionHeader>
                            <BestLifts allRoutineExercises={allRoutineExercises} bestSets={bestSets} unit={unit} />
                        </div>

                    </div>

                    {/* Session History: calendar + recent workout rows */}
                    {hasData && (
                        <div className="mt-8">
                            {/* Header */}
                            <SectionHeader>Workouts</SectionHeader>

                            {/* Two-column layout on desktop: calendar left, workout list right */}
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[330px_1fr] lg:gap-[18px] lg:items-start">
                                {/* Sessions calendar, month name + nav at the top */}
                                <div className="bg-pulse-surface rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <button
                                            type="button"
                                            onClick={() => shiftMonth(-1)}
                                            aria-label="Previous month"
                                            className="cursor-pointer border-none bg-transparent p-1 text-pulse-muted hover:text-pulse-text">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                <polyline points="15 18 9 12 15 6" />
                                            </svg>
                                        </button>
                                        <span className="font-pulse text-[0.8125rem] font-semibold text-pulse-text tracking-[0.02em]">
                                            {new Date(calendarYear, calendarMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => shiftMonth(1)}
                                            aria-label="Next month"
                                            className="cursor-pointer border-none bg-transparent p-1 text-pulse-muted hover:text-pulse-text">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </button>
                                    </div>
                                    <SessionsCalendar
                                        year={calendarYear}
                                        month={calendarMonth}
                                        sessions={workoutSessions}
                                        tz={profile.timezone}
                                        onSelectDay={openCalendarSession}
                                    />
                                </div>

                                {/* Recent workout rows (4 most recent) */}
                                <div className="flex flex-col gap-2">
                                    {workouts.slice(0, 4).map((w) => {
                                        const label =
                                            (WORKOUT_TYPE_LABELS[w.workoutType as WorkoutType] ?? w.workoutType) +
                                            (w.variant ? ` ${w.variant}` : '');
                                        const dateIso = w.date.split('T')[0];
                                        const dateLabel = formatLogDate(dateIso, todayIso);
                                        const exerciseCount = w.exercises.length;
                                        return (
                                            <button
                                                key={w.id}
                                                type="button"
                                                onClick={() => setDetailWorkout(w)}
                                                className="flex items-center justify-between rounded-xl bg-pulse-surface px-[13px] py-[11px] text-left cursor-pointer border-none hover:bg-pulse-surface-2 transition-colors">
                                                <div>
                                                    <div className="font-pulse font-medium text-[0.88rem] text-pulse-text">
                                                        {label}
                                                    </div>
                                                    <div className="font-pulse text-[0.73rem] text-pulse-muted mt-[3px]">
                                                        {dateLabel} · {w.setCount} sets · {exerciseCount}{' '}
                                                        {exerciseCount === 1 ? 'exercise' : 'exercises'}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {workouts.length > 4 && (
                                        <button
                                            type="button"
                                            onClick={() => setAllWorkoutsOpen(true)}
                                            className="mt-1 w-full flex items-center justify-center gap-[7px] rounded-xl bg-pulse-surface px-4 py-[11px] font-pulse text-[0.8rem] font-medium text-pulse-accent border-none cursor-pointer hover:bg-pulse-surface-2 transition-colors">
                                            Show all {workouts.length} workouts
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Session detail modal */}
                    <SessionDetailModal
                        open={detailWorkout !== null}
                        workout={detailWorkout}
                        unit={unit}
                        onClose={() => setDetailWorkout(null)}
                    />

                    {/* All workouts modal */}
                    <AllWorkoutsModal
                        open={allWorkoutsOpen}
                        workouts={workouts}
                        todayIso={todayIso}
                        unit={unit}
                        onClose={() => setAllWorkoutsOpen(false)}
                        onSelectWorkout={(w) => { setAllWorkoutsOpen(false); setDetailWorkout(w); }}
                    />

                    {!hasData && (
                        <div className="py-16 px-4 text-center">
                            <div className="font-pulse text-[0.8125rem] tracking-[0.1em] uppercase text-pulse-dim mb-3">
                                No workouts yet
                            </div>
                            <div className="font-pulse text-[0.75rem] text-pulse-dim tracking-[0.04em]">
                                Head to Log to get started.
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Body panel */}
            {progressTab === 'body' && (
                <div id="panel-body" role="tabpanel" aria-labelledby="tab-body">
                    {/* Summary top row: goal weight (50%) + recent change (50%) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px] mt-[6px]">
                        {/* Goal weight card */}
                        <div className="flex flex-col">
                            <div className="font-pulse text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-pulse-muted mb-2">
                                Goal weight
                            </div>
                            <div className="rounded-2xl bg-pulse-surface p-5 flex-1">
                                <GoalWeightSummary />
                            </div>
                        </div>
                        {/* Recent change card */}
                        <div className="flex flex-col">
                            <RecentChangeCard
                                readout={recomp}
                                unit={unit}
                                lengthUnit={profile.length_unit}
                                weeks={progressWindow === 'week' ? 1 : progressWindow === 'all' ? Math.max(...Object.keys(volByWeek).map(Number).filter(Boolean), 1) : 12}
                            />
                        </div>
                    </div>

                    {/* Body weight + Measurements two-column grid (bare columns, chart is the only surface block, per the mockup) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] mt-4 items-start">
                        <BodyWeightCard />
                        <MeasurementsCard />
                    </div>
                </div>
            )}
        </div>
    );
}
