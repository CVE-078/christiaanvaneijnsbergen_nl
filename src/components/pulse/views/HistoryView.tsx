'use client';
import { memo, useMemo, useState } from 'react';
import {
    calcE1RM,
    toDisplay,
    computeE1RMHistory,
    swapKey,
    parseLogKey,
    computeStrengthByWeek,
    computeRecompSignal,
    computeRecoveryFlags,
} from '@/lib/pulse/utils';
import { computeHistoryBundle } from '@/lib/pulse/historyBundle';
import { usePulse } from '@/context/PulseContext';
import VolumeChart from '@/components/pulse/VolumeChart';
import StreakCalendar from '@/components/pulse/StreakCalendar';
import E1RMChart from '@/components/pulse/E1RMChart';
import BestLifts from '@/components/pulse/BestLifts';
import MuscleVolumeBars from '@/components/pulse/MuscleVolumeBars';
import RecompCard from '@/components/pulse/RecompCard';
import RecoveryCard from '@/components/pulse/RecoveryCard';
import StrengthScoreCard from '@/components/pulse/StrengthScoreCard';
import PageTitle from '@/components/pulse/PageTitle';
import { computeStrengthScore } from '@/lib/pulse/strength';
import PageSkeleton, { ErrorState } from '@/components/pulse/PageSkeleton';
import { VOLUME_TARGETS } from '@/lib/pulse/data';
import type { Unit, Logs } from '@/lib/pulse/types';

// Dashboard time window. 'cycle' is the current 12-week program (default), 'all'
// is every logged week (distinct once data spans multiple cycles), 'week' zooms
// the period-based widgets to the active week. Strength Score and Personal
// Records stay all-time regardless — they are lifetime records, not trends.
type ProgressWindow = 'week' | 'cycle' | 'all';

const WINDOW_LABELS: Record<ProgressWindow, string> = { week: 'Week', cycle: 'Cycle', all: 'All' };

function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="font-pulse text-[0.75rem] tracking-[0.16em] uppercase text-pulse-muted mb-5">{children}</div>
    );
}

// A single set row with its precomputed PR flag and resolved exercise name.
type SessionCardSet = {
    setIdx: number;
    reps: number;
    rir: number;
    kg: number;
    name: string;
    isPR: boolean;
    drops?: Array<{ kg: number; reps: number }>;
};

type SessionCardData = {
    week: number;
    setCount: number;
    sets: SessionCardSet[];
};

// Memoized so a session card only re-renders when its own data or unit changes,
// rather than on every HistoryView render.
const SessionCard = memo(function SessionCard({ session, unit }: { session: SessionCardData; unit: Unit }) {
    return (
        <div className="bg-pulse-surface rounded-xl overflow-hidden">
            <div className="py-3 px-4 flex items-center gap-3">
                <span className="font-pulse text-[0.75rem] tracking-[0.1em] uppercase font-semibold text-pulse-accent">
                    Week {session.week}
                </span>
                <span className="font-pulse text-[0.6875rem] text-pulse-muted ml-auto">{session.setCount} sets</span>
            </div>
            <div className="px-4 pb-3 flex flex-col">
                {session.sets.map((set, i) => (
                    <div key={i} className="flex flex-col py-[6px]">
                        <div className="flex items-center gap-3">
                            <span className="font-pulse text-[0.6875rem] text-pulse-muted w-5 shrink-0">
                                {String(set.setIdx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-pulse-text text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                {set.name}
                            </span>
                            <span className="font-pulse text-pulse-text font-medium text-sm shrink-0">
                                {toDisplay(set.kg, unit)} {unit} × {set.reps}
                            </span>
                            {set.isPR && (
                                <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent shrink-0">
                                    PR
                                </span>
                            )}
                            {set.rir === 0 && (
                                <span
                                    className="font-pulse text-[0.625rem] uppercase tracking-[0.08em] text-pulse-accent shrink-0"
                                    title="Taken to failure">
                                    Failure
                                </span>
                            )}
                            <span className="font-pulse text-pulse-muted text-[0.75rem] shrink-0">{set.rir} RIR</span>
                        </div>
                        {set.drops && set.drops.length > 0 && (
                            <div className="font-pulse text-[0.6875rem] text-pulse-dim pl-8 mt-0.5">
                                ↓{' '}
                                {set.drops.map((d, di) => (
                                    <span key={di}>
                                        {di > 0 && <span className="text-pulse-muted"> · </span>}
                                        {toDisplay(d.kg, unit)} × {d.reps}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});

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
            const inWindow = progressWindow === 'week' ? parsed.week === activeWeek : parsed.week >= 1 && parsed.week <= 12;
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

    // Same routine-exercise list and week that produce muscleVolume above, so
    // recovery flags align 1:1 with the volume rows.
    const recovery = useMemo(
        () => computeRecoveryFlags(logs, activeRoutineExercises, activeWeek, VOLUME_TARGETS),
        [logs, activeRoutineExercises, activeWeek],
    );

    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
    const exerciseId = selectedExerciseId ?? defaultExerciseId;

    const e1rmHistory = useMemo(
        () => (exerciseId ? computeE1RMHistory(windowedLogs, exerciseId) : []),
        [windowedLogs, exerciseId],
    );

    // Precompute the per-set PR flag and resolved exercise name once per
    // logs/prMap/nameMap change, so the render map does not call calcE1RM
    // on every render.
    const sessionCards = useMemo<SessionCardData[]>(
        () =>
            sessions.map((session) => ({
                week: session.week,
                setCount: session.sets.length,
                sets: session.sets.map((set) => {
                    const bestE1RM = prMap[set.routineExerciseId] ?? 0;
                    const isPR = bestE1RM > 0 && calcE1RM(set.kg, set.reps) >= bestE1RM;
                    return {
                        setIdx: set.setIdx,
                        reps: set.reps,
                        rir: set.rir,
                        kg: set.kg,
                        name: (() => {
                            const subId = swaps[swapKey(session.week, set.routineExerciseId)];
                            if (subId) return exerciseNameById.get(subId) ?? nameMap.get(set.routineExerciseId) ?? '—';
                            return nameMap.get(set.routineExerciseId) ?? '—';
                        })(),
                        isPR,
                        ...(set.drops && set.drops.length > 0 ? { drops: set.drops } : {}),
                    };
                }),
            })),
        [sessions, prMap, nameMap, swaps, exerciseNameById],
    );

    // Top personal records, pulled over from the old ProfileView. Ranked by
    // estimated 1RM and capped at five, with names resolved from the routine.
    const prRecords = useMemo(
        () =>
            Object.entries(prMap)
                .map(([reId, e1rm]) => ({ name: nameMap.get(reId) ?? reId, e1rm }))
                .sort((a, b) => b.e1rm - a.e1rm)
                .slice(0, 5),
        [prMap, nameMap],
    );

    // Session history shows the last four by default (most recent week first),
    // with the rest revealed behind a toggle.
    const [showAllSessions, setShowAllSessions] = useState(false);
    const sortedSessionCards = useMemo(
        () => [...sessionCards].sort((a, b) => b.week - a.week),
        [sessionCards],
    );
    const visibleSessionCards = showAllSessions ? sortedSessionCards : sortedSessionCards.slice(0, 4);

    const hasData = sessions.length > 0;

    if (errors?.routines || errors?.logs) return <ErrorState onRetry={retry} />;
    if (loading?.routines || loading?.logs) return <PageSkeleton />;

    return (
        <div className="p-4 sm:p-8 max-w-[960px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
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

            {/* TIER 1: headline + recovery coaching */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <StrengthScoreCard strength={strength} />
                <RecoveryCard recovery={recovery} />
            </div>

            {/* TIER 2: recomp readout, full width */}
            <div className="mb-4">
                <RecompCard readout={recomp} unit={unit} lengthUnit={profile.length_unit} />
            </div>

            {/* TIER 3: training trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Weekly Volume */}
                <div className="bg-pulse-surface rounded-2xl p-5">
                    <SectionHeader>Sets per week</SectionHeader>
                    {hasData ? (
                        <VolumeChart volByWeek={volByWeek} currentWeek={activeWeek} />
                    ) : (
                        <p className="font-pulse text-[0.75rem] text-pulse-dim py-4">
                            Log a session to see volume trends.
                        </p>
                    )}
                </div>

                {/* e1RM Progression */}
                <div className="bg-pulse-surface rounded-2xl p-5">
                    <div className="flex items-center gap-2">
                        <SectionHeader>e1RM Progression</SectionHeader>
                        {allRoutineExercises.length > 0 && (
                            <select
                                aria-label="Exercise"
                                value={exerciseId ?? ''}
                                onChange={(e) => setSelectedExerciseId(e.target.value || null)}
                                className="font-pulse text-[0.6875rem] bg-pulse-surface-2 rounded px-2 py-[3px] text-pulse-dim ml-auto -mt-3 mb-5">
                                {allRoutineExercises.map((re) => (
                                    <option key={re.id} value={re.id}>
                                        {re.exercise.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <E1RMChart history={e1rmHistory} unit={unit} />
                </div>

                {/* Per-muscle volume this week */}
                <div className="bg-pulse-surface rounded-2xl p-5">
                    <SectionHeader>Volume by muscle - Week {activeWeek}</SectionHeader>
                    <MuscleVolumeBars volume={muscleVolume} targets={VOLUME_TARGETS} />
                </div>

                {/* Streak */}
                <div className="bg-pulse-surface rounded-2xl p-5">
                    <SectionHeader>Weekly streak - 12 weeks</SectionHeader>
                    <StreakCalendar logs={logs} currentWeek={activeWeek} />
                    <p className="sr-only">
                        {streak === 0
                            ? 'No streak yet.'
                            : `Current streak: ${streak} consecutive week${streak !== 1 ? 's' : ''}.`}
                    </p>
                </div>

                {/* Best Lifts */}
                <div className="bg-pulse-surface rounded-2xl p-5">
                    <SectionHeader>Best Lifts</SectionHeader>
                    <BestLifts allRoutineExercises={allRoutineExercises} bestSets={bestSets} unit={unit} />
                </div>

                {/* Personal Records - pulled over from Profile */}
                <div className="bg-pulse-surface rounded-2xl p-5">
                    <SectionHeader>Personal Records</SectionHeader>
                    {prRecords.length === 0 ? (
                        <p className="font-pulse text-[0.75rem] text-pulse-dim py-2">
                            No records yet — start logging sets.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2.5">
                            {prRecords.map((pr) => (
                                <li key={pr.name} className="flex items-center justify-between gap-3">
                                    <span className="font-pulse text-[0.8125rem] text-pulse-dim overflow-hidden text-ellipsis whitespace-nowrap">
                                        {pr.name}
                                    </span>
                                    <span className="font-pulse text-[0.8125rem] font-semibold text-pulse-accent shrink-0">
                                        {unit === 'kg'
                                            ? `${toDisplay(pr.e1rm, 'kg').toFixed(1)} kg`
                                            : `${toDisplay(pr.e1rm, 'lbs').toFixed(1)} lbs`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Session History - last 4 by default, rest behind a toggle */}
            {hasData && (
                <div className="mt-12">
                    <SectionHeader>Recent sessions</SectionHeader>
                    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
                        {visibleSessionCards.map((session) => (
                            <SessionCard key={session.week} session={session} unit={unit} />
                        ))}
                    </div>
                    {sortedSessionCards.length > 4 && (
                        <button
                            type="button"
                            onClick={() => setShowAllSessions((v) => !v)}
                            aria-expanded={showAllSessions}
                            className="mt-3 w-full flex items-center justify-between rounded-xl bg-pulse-surface px-4 py-3 font-pulse text-[0.8125rem] text-pulse-dim hover:text-pulse-text transition-colors">
                            <span>
                                {showAllSessions
                                    ? 'Show fewer sessions'
                                    : `Show all ${sortedSessionCards.length} sessions`}
                            </span>
                            <span className="text-pulse-muted">{showAllSessions ? '↑' : '↓'}</span>
                        </button>
                    )}
                </div>
            )}

            {!hasData && (
                <div className="py-16 px-4 text-center">
                    <div className="font-pulse text-[0.8125rem] tracking-[0.1em] uppercase text-pulse-dim mb-3">
                        No sessions yet
                    </div>
                    <div className="font-pulse text-[0.75rem] text-pulse-dim tracking-[0.04em]">
                        Head to Log to get started.
                    </div>
                </div>
            )}
        </div>
    );
}
