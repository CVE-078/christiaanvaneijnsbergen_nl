'use client';
import { useState } from 'react';
import { parseMaxSets, calcE1RM } from '@/lib/pulse/utils';
// TODO(4.5): replace with routine-based logKey once ExerciseCard is rewritten
function legacyLogKey(week: number, type: string, exIdx: number, setIdx: number): string {
    return `${week}-${type}-${exIdx}-${setIdx}`;
}
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
    const savedCount = Array.from({ length: maxSets }, (_, i) => legacyLogKey(week, type, exIdx, i)).filter(
        (k) => logs[k]?.saved,
    ).length;
    const complete = savedCount >= maxSets;
    const bestE1RM = prMap[`${type}-${exIdx}`] ?? 0;

    return (
        <div
            className={`rounded-2xl overflow-hidden border transition-colors duration-150 ${
                complete ? 'border-pulse-accent/25 bg-pulse-surface' : 'border-pulse-border bg-pulse-surface'
            }`}>
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${exercise.name}${complete ? ' — all sets done' : ''}`}
                className="w-full py-3.5 px-4 bg-transparent border-none cursor-pointer flex items-center gap-3 text-left">
                {/* Small index chip */}
                <span
                    className={`font-pulse text-[0.6875rem] font-bold w-6 h-6 rounded-md flex items-center justify-center shrink-0 select-none ${
                        complete ? 'bg-pulse-accent/15 text-pulse-accent' : 'bg-pulse-surface-2 text-pulse-dim'
                    }`}>
                    {exIdx + 1}
                </span>
                <div className="flex-1 min-w-0">
                    <div className={`font-pulse text-[0.9375rem] font-semibold truncate ${complete ? 'text-pulse-text' : 'text-white'}`}>
                        {exercise.name}
                    </div>
                    <div className="font-pulse text-xs text-pulse-dim mt-0.5">
                        {exercise.sets} sets · {exercise.reps} reps
                    </div>
                </div>
                {/* Progress pips + count */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-pulse text-xs font-semibold">
                        <span className="text-pulse-text">{savedCount}</span>
                        <span className="text-pulse-muted">/{maxSets}</span>
                    </span>
                    <div className="flex gap-[3px]">
                        {Array.from({ length: maxSets }, (_, i) => (
                            <span
                                key={i}
                                className="block w-[5px] h-[5px] rounded-sm transition-colors duration-200"
                                style={{
                                    background:
                                        i < savedCount
                                            ? 'var(--color-pulse-accent)'
                                            : 'var(--color-pulse-muted)',
                                }}
                            />
                        ))}
                    </div>
                </div>
                {complete && (
                    <span aria-label="All sets done" className="font-pulse text-xs text-pulse-accent shrink-0">
                        ✓
                    </span>
                )}
                <svg
                    className={`w-3.5 h-3.5 text-pulse-dim shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden>
                    <polyline points="6,3 11,8 6,13" />
                </svg>
            </button>

            {open && (
                <div className="border-t border-pulse-border px-4 pt-1 pb-4">
                    <p className="font-pulse text-xs text-pulse-dim pt-2.5 pb-2 leading-relaxed">
                        {exercise.load} · {exercise.note}
                    </p>
                    {Array.from({ length: maxSets }, (_, i) => {
                        const entry = logs[legacyLogKey(week, type, exIdx, i)];
                        const isPR = !!(entry?.saved && bestE1RM > 0 && calcE1RM(entry.kg, entry.reps) >= bestE1RM);
                        const prevEntry = week > 1 ? logs[legacyLogKey(week - 1, type, exIdx, i)] : undefined;
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
                                onSave={(e) => onSave(legacyLogKey(week, type, exIdx, i), e)}
                                onDelete={() => onDelete(legacyLogKey(week, type, exIdx, i))}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
