'use client';
import { useMemo } from 'react';
import { buildHistory, calcE1RM, toDisplay } from '@/lib/pulse/utils';
import { WORKOUTS } from '@/lib/pulse/data';
import { usePulse } from '@/context/PulseContext';

export default function HistoryView() {
    const { logs, profile, prMap } = usePulse();
    const unit = profile.unit;
    const sessions = useMemo(() => buildHistory(logs), [logs]);

    if (sessions.length === 0) {
        return (
            <div className="py-16 px-4 text-center">
                <div className="font-pulse text-[0.8125rem] tracking-[0.1em] uppercase text-pulse-muted mb-3">
                    No sessions yet
                </div>
                <div className="font-pulse text-[0.75rem] text-pulse-muted tracking-[0.04em]">
                    Head to Log to get started.
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-[600px] mx-auto flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:max-w-[1100px] lg:items-start">
            {sessions.map((session) => {
                const workout = WORKOUTS[session.type];
                return (
                    <div
                        key={`${session.week}-${session.type}`}
                        className="bg-pulse-surface border border-pulse-border rounded overflow-hidden">
                        <div className="py-3 px-4 border-b border-pulse-border flex items-center gap-3">
                            <span className="font-pulse text-[0.75rem] tracking-[0.1em] uppercase font-bold text-pulse-accent">
                                {workout.label}
                            </span>
                            <span className="font-pulse text-[0.75rem] text-pulse-dim tracking-[0.04em]">
                                Week {session.week}
                            </span>
                            <span className="font-pulse text-[0.6875rem] text-pulse-muted ml-auto">
                                {session.sets.length} sets
                            </span>
                        </div>
                        <div className="py-2 px-4 pb-3">
                            {session.sets.map((set, i) => {
                                const exercise = workout.exercises[set.exIdx];
                                const exKey = `${session.type}-${set.exIdx}`;
                                const bestE1RM = prMap[exKey] ?? 0;
                                const isPR = bestE1RM > 0 && calcE1RM(set.kg, set.reps) >= bestE1RM;
                                return (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-3 py-1 ${i < session.sets.length - 1 ? 'border-b border-pulse-border' : ''}`}>
                                        <span className="font-pulse text-[0.6875rem] text-pulse-muted w-5 shrink-0">
                                            {String(set.setIdx + 1).padStart(2, '0')}
                                        </span>
                                        <span className="text-pulse-dim text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                            {exercise?.name ?? `Exercise ${set.exIdx + 1}`}
                                        </span>
                                        <span className="font-pulse text-white font-semibold text-sm shrink-0">
                                            {toDisplay(set.kg, unit)} {unit} × {set.reps}
                                        </span>
                                        {isPR && (
                                            <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                                                PR
                                            </span>
                                        )}
                                        <span className="font-pulse text-pulse-muted text-[0.75rem] shrink-0">
                                            {set.rir} RIR
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
