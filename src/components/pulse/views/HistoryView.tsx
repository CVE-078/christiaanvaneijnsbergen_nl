'use client';
import { memo, useMemo, useState } from 'react';
import {
    calcE1RM,
    toDisplay,
    computeE1RMHistory,
    swapKey,
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
import StrengthScoreCard from '@/components/pulse/StrengthScoreCard';
import { computeStrengthScore } from '@/lib/pulse/strength';
import PageSkeleton, { ErrorState } from '@/components/pulse/PageSkeleton';
import { VOLUME_TARGETS } from '@/lib/pulse/data';
import type { Unit } from '@/lib/pulse/types';

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

    const recomp = useMemo(
        () =>
            computeRecompSignal({
                bodyweight: bodyweightLogs,
                measurements: bodyMeasurements,
                strengthByWeek: computeStrengthByWeek(logs),
            }),
        [bodyweightLogs, bodyMeasurements, logs],
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
        () => computeHistoryBundle(logs, allRoutineExercises, activeRoutineExercises, activeWeek),
        [logs, allRoutineExercises, activeRoutineExercises, activeWeek],
    );

    // Same routine-exercise list and week that produce muscleVolume above, so
    // recovery flags align 1:1 with the volume rows.
    const recovery = useMemo(
        () => computeRecoveryFlags(logs, activeRoutineExercises, activeWeek, VOLUME_TARGETS),
        [logs, activeRoutineExercises, activeWeek],
    );

    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
    const exerciseId = selectedExerciseId ?? defaultExerciseId;

    const e1rmHistory = useMemo(() => (exerciseId ? computeE1RMHistory(logs, exerciseId) : []), [logs, exerciseId]);

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

    const hasData = sessions.length > 0;

    if (errors?.routines || errors?.logs) return <ErrorState onRetry={retry} />;
    if (loading?.routines || loading?.logs) return <PageSkeleton />;

    return (
        <div className="p-4 sm:p-8 max-w-[960px] mx-auto">
            {/* Header */}
            <div className="flex items-baseline justify-between gap-3 mb-8">
                <h1 className="font-pulse text-[1.75rem] sm:text-[2.25rem] font-medium tracking-[-0.018em] text-pulse-text">
                    Progress
                </h1>
                <span className="font-pulse-body text-[0.8125rem] text-pulse-muted tracking-[0.03em]">
                    {streak === 0 ? 'No streak yet' : `${streak}-week streak`}
                </span>
            </div>

            {/* Strength Score headline */}
            <div className="mb-4">
                <StrengthScoreCard strength={strength} />
            </div>

            {/* Recomp readout */}
            <div className="mb-12">
                <RecompCard readout={recomp} unit={unit} lengthUnit={profile.length_unit} />
            </div>

            {/* Four data blocks - separated by tone and whitespace, two columns on wide screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-12">
                {/* Streak */}
                <div>
                    <SectionHeader>Weekly streak - 12 weeks</SectionHeader>
                    <StreakCalendar logs={logs} currentWeek={activeWeek} />
                    <p className="sr-only">
                        {streak === 0
                            ? 'No streak yet.'
                            : `Current streak: ${streak} consecutive week${streak !== 1 ? 's' : ''}.`}
                    </p>
                </div>

                {/* Best Lifts */}
                <div>
                    <SectionHeader>Best Lifts</SectionHeader>
                    <BestLifts allRoutineExercises={allRoutineExercises} bestSets={bestSets} unit={unit} />
                </div>

                {/* Weekly Volume */}
                <div>
                    <SectionHeader>Sets per week</SectionHeader>
                    {hasData ? (
                        <VolumeChart volByWeek={volByWeek} currentWeek={activeWeek} />
                    ) : (
                        <p className="font-pulse text-[0.75rem] text-pulse-dim py-4">
                            Log a session to see volume trends.
                        </p>
                    )}
                </div>

                {/* Per-muscle volume this week */}
                <div>
                    <SectionHeader>Volume by muscle - Week {activeWeek}</SectionHeader>
                    <MuscleVolumeBars volume={muscleVolume} targets={VOLUME_TARGETS} recovery={recovery} />
                </div>

                {/* e1RM Progression */}
                <div>
                    <div className="flex items-center gap-2">
                        <SectionHeader>e1RM Progression</SectionHeader>
                        {allRoutineExercises.length > 0 && (
                            <select
                                aria-label="Exercise"
                                value={exerciseId ?? ''}
                                onChange={(e) => setSelectedExerciseId(e.target.value || null)}
                                className="font-pulse text-[0.6875rem] bg-pulse-surface rounded px-2 py-[3px] text-pulse-dim ml-auto -mt-3 mb-5">
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
            </div>

            {/* Session History */}
            {hasData && (
                <div className="mt-12">
                    <SectionHeader>Session History</SectionHeader>
                    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
                        {sessionCards.map((session) => (
                            <SessionCard key={session.week} session={session} unit={unit} />
                        ))}
                    </div>
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
