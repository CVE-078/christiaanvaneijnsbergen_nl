'use client';
import { useMemo, useState } from 'react';
import {
    buildHistory,
    calcE1RM,
    toDisplay,
    computeVolumeByTypeAndWeek,
    computeE1RMHistory,
    computeBestSets,
} from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import VolumeChart from '@/components/pulse/VolumeChart';
import StreakCalendar from '@/components/pulse/StreakCalendar';
import E1RMChart from '@/components/pulse/E1RMChart';
import BestLifts from '@/components/pulse/BestLifts';

function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="font-pulse text-[0.6875rem] tracking-[0.12em] uppercase text-pulse-dim mb-2">
            {children}
        </div>
    );
}

export default function HistoryView() {
    const { logs, profile, prMap, routines, streak } = usePulse();
    const unit = profile.unit;

    const allRoutineExercises = useMemo(
        () => routines.flatMap((r) => r.exercises),
        [routines],
    );

    const nameMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const re of allRoutineExercises) m.set(re.id, re.exercise.name);
        return m;
    }, [allRoutineExercises]);

    const sessions = useMemo(() => buildHistory(logs), [logs]);

    const volByWeek = useMemo(
        () => computeVolumeByTypeAndWeek(logs, allRoutineExercises),
        [logs, allRoutineExercises],
    );

    const bestSets = useMemo(() => computeBestSets(logs), [logs]);

    const defaultExerciseId = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const [key, val] of Object.entries(logs)) {
            if (!val?.saved) continue;
            const firstDash = key.indexOf('-');
            const lastDash = key.lastIndexOf('-');
            if (firstDash === -1 || lastDash === firstDash) continue;
            const id = key.slice(firstDash + 1, lastDash);
            counts[id] = (counts[id] ?? 0) + 1;
        }
        return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
    }, [logs]);

    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
    const exerciseId = selectedExerciseId ?? defaultExerciseId;

    const e1rmHistory = useMemo(
        () => (exerciseId ? computeE1RMHistory(logs, exerciseId) : []),
        [logs, exerciseId],
    );

    const hasData = sessions.length > 0;

    return (
        <div className="p-4 max-w-[820px] mx-auto flex flex-col gap-4">
            {/* Streak */}
            <div className="bg-pulse-surface border border-pulse-border rounded p-4">
                <div className="flex items-baseline gap-2 mb-3">
                    <SectionHeader>Streak</SectionHeader>
                    <span className="font-pulse text-[0.75rem] text-pulse-accent font-semibold ml-auto">
                        {streak} {streak === 1 ? 'week' : 'weeks'}
                    </span>
                </div>
                <StreakCalendar logs={logs} />
                <p className="sr-only">
                    {streak === 0
                        ? 'No streak yet.'
                        : `Current streak: ${streak} consecutive week${streak !== 1 ? 's' : ''}.`}
                </p>
            </div>

            {/* Weekly Volume */}
            <div className="bg-pulse-surface border border-pulse-border rounded p-4">
                <SectionHeader>Weekly Volume</SectionHeader>
                {hasData ? (
                    <VolumeChart volByWeek={volByWeek} />
                ) : (
                    <p className="font-pulse text-[0.75rem] text-pulse-dim py-4 text-center">
                        Log a session to see volume trends.
                    </p>
                )}
            </div>

            {/* e1RM Progression */}
            <div className="bg-pulse-surface border border-pulse-border rounded p-4">
                <div className="flex items-center gap-2 mb-3">
                    <SectionHeader>e1RM Progression</SectionHeader>
                    {allRoutineExercises.length > 0 && (
                        <select
                            aria-label="Exercise"
                            value={exerciseId ?? ''}
                            onChange={(e) => setSelectedExerciseId(e.target.value || null)}
                            className="font-pulse text-[0.6875rem] bg-pulse-surface-2 border border-pulse-border rounded px-2 py-[3px] text-pulse-text ml-auto"
                        >
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

            {/* Best Lifts */}
            <div className="bg-pulse-surface border border-pulse-border rounded p-4">
                <SectionHeader>Best Lifts</SectionHeader>
                <BestLifts
                    allRoutineExercises={allRoutineExercises}
                    bestSets={bestSets}
                    unit={unit}
                />
            </div>

            {/* Session History */}
            {hasData && (
                <div>
                    <SectionHeader>Session History</SectionHeader>
                    <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
                        {sessions.map((session) => (
                            <div
                                key={session.week}
                                className="bg-pulse-surface border border-pulse-border rounded overflow-hidden">
                                <div className="py-3 px-4 border-b border-pulse-border flex items-center gap-3">
                                    <span className="font-pulse text-[0.75rem] tracking-[0.1em] uppercase font-bold text-pulse-accent">
                                        Week {session.week}
                                    </span>
                                    <span className="font-pulse text-[0.6875rem] text-pulse-dim ml-auto">
                                        {session.sets.length} sets
                                    </span>
                                </div>
                                <div className="py-2 px-4 pb-3">
                                    {session.sets.map((set, i) => {
                                        const bestE1RM = prMap[set.routineExerciseId] ?? 0;
                                        const isPR =
                                            bestE1RM > 0 &&
                                            calcE1RM(set.kg, set.reps) >= bestE1RM;
                                        return (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-3 py-1 ${
                                                    i < session.sets.length - 1
                                                        ? 'border-b border-pulse-border'
                                                        : ''
                                                }`}>
                                                <span className="font-pulse text-[0.6875rem] text-pulse-dim w-5 shrink-0">
                                                    {String(set.setIdx + 1).padStart(2, '0')}
                                                </span>
                                                <span className="text-pulse-text text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                                    {nameMap.get(set.routineExerciseId) ?? '—'}
                                                </span>
                                                <span className="font-pulse text-white font-semibold text-sm shrink-0">
                                                    {toDisplay(set.kg, unit)} {unit} × {set.reps}
                                                </span>
                                                {isPR && (
                                                    <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                                                        PR
                                                    </span>
                                                )}
                                                <span className="font-pulse text-pulse-dim text-[0.75rem] shrink-0">
                                                    {set.rir} RIR
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
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
