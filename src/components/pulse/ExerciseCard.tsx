'use client';
import { useState } from 'react';
import { logKey, parseMaxSets, calcE1RM } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import type { Exercise, Logs, LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

interface Props {
    exercise: Exercise;
    exIdx: number;
    week: number;
    type: WorkoutType;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}

export default function ExerciseCard({ exercise, exIdx, week, type, logs, prMap, unit, onSave, onDelete }: Props) {
    const [open, setOpen] = useState(false);
    const maxSets = parseMaxSets(exercise.sets);
    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, type, exIdx, i)).filter(
        (k) => logs[k]?.saved,
    ).length;
    const complete = savedCount >= maxSets;
    const bestE1RM = prMap[`${type}-${exIdx}`] ?? 0;

    return (
        <div className="bg-pulse-surface border border-pulse-border rounded overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${exercise.name}${complete ? ' — all sets done' : ''}`}
                className="w-full py-3.5 px-4 bg-transparent border-none cursor-pointer flex items-center gap-4 text-left">
                <span className="font-pulse text-[1.75rem] font-bold text-[#222] leading-none w-9 shrink-0 tracking-[-0.04em] select-none">
                    {String(exIdx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-[0.9375rem] truncate">
                        {exercise.name}
                    </div>
                    <div className="font-pulse text-[0.625rem] tracking-[0.06em] text-pulse-dim mt-1 uppercase">
                        {exercise.sets} sets · {exercise.reps} reps
                    </div>
                </div>
                <span className="font-pulse text-[0.875rem] tracking-[0.05em] shrink-0">
                    {Array.from({ length: maxSets }, (_, i) => (
                        <span key={i} className={i < savedCount ? 'text-pulse-accent' : 'text-pulse-muted'}>
                            {i < savedCount ? '█' : '░'}
                        </span>
                    ))}
                </span>
                {complete && (
                    <span
                        aria-label="All sets done"
                        className="font-pulse text-[0.625rem] text-pulse-accent ml-1.5 shrink-0">
                        ✓
                    </span>
                )}
            </button>

            {open && (
                <div className="border-t border-pulse-border px-4 pt-1 pb-3.5">
                    <p className="font-pulse text-[0.6875rem] text-pulse-dim pt-[0.625rem] pb-1.5 leading-[1.6]">
                        {exercise.load} · {exercise.note}
                    </p>
                    {Array.from({ length: maxSets }, (_, i) => {
                        const entry = logs[logKey(week, type, exIdx, i)];
                        const isPR = !!(entry?.saved && bestE1RM > 0 && calcE1RM(entry.kg, entry.reps) >= bestE1RM);
                        const prevEntry = week > 1 ? logs[logKey(week - 1, type, exIdx, i)] : undefined;
                        return (
                            <SetLogger
                                key={`${week}-${i}`}
                                setIdx={i}
                                week={week}
                                type={type}
                                entry={entry}
                                previousEntry={prevEntry?.saved ? prevEntry : undefined}
                                isPR={isPR}
                                unit={unit}
                                onSave={(e) => onSave(logKey(week, type, exIdx, i), e)}
                                onDelete={() => onDelete(logKey(week, type, exIdx, i))}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
