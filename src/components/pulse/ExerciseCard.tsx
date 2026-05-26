'use client';
import { useState } from 'react';
import { logKey, parseMaxSets, calcE1RM } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import type { Exercise, Logs, LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

const GREEN = '#22c55e';

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
        <div
            className={`bg-pulse-surface rounded overflow-hidden border ${complete ? 'border-[rgba(34,197,94,0.2)]' : 'border-pulse-border'}`}>
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${exercise.name}${complete ? ' — all sets done' : ''}`}
                className="w-full py-[0.875rem] px-4 bg-transparent border-none cursor-pointer flex items-center gap-3 text-left">
                <span
                    className={`font-pulse text-[1.75rem] font-bold leading-none w-9 shrink-0 tracking-[-0.04em] select-none ${complete ? 'text-[rgba(34,197,94,0.4)]' : 'text-[#333]'}`}>
                    {String(exIdx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-base truncate">{exercise.name}</div>
                    <div className="font-pulse text-[0.75rem] tracking-[0.06em] text-pulse-dim mt-1 uppercase">
                        {exercise.sets} sets · {exercise.reps} reps
                    </div>
                </div>
                {/* Dot indicators replacing ░█ progress chars */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-pulse text-sm font-bold">
                        <span className="text-white">{savedCount}</span>
                        <span className="text-pulse-muted">/{maxSets}</span>
                    </span>
                    <div className="flex gap-[3px]">
                        {Array.from({ length: maxSets }, (_, i) => (
                            <span
                                key={i}
                                className="block w-1.5 h-1.5 rounded-full transition-colors duration-200"
                                style={{
                                    background:
                                        i < savedCount
                                            ? complete
                                                ? GREEN
                                                : 'var(--color-pulse-accent)'
                                            : 'var(--color-pulse-muted)',
                                }}
                            />
                        ))}
                    </div>
                </div>
                {complete && (
                    <span
                        aria-label="All sets done"
                        className="font-pulse text-[0.75rem] text-[#22c55e] ml-1.5 shrink-0">
                        ✓
                    </span>
                )}
                <svg
                    className={`w-3.5 h-3.5 text-pulse-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
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

            {/* 2px progress bar — visible when open */}
            {open && (
                <div className="h-[2px] bg-pulse-muted overflow-hidden">
                    {/* width is runtime ratio — must stay inline */}
                    <div
                        className="h-full bg-pulse-accent transition-[width] duration-300"
                        style={{ width: `${(savedCount / maxSets) * 100}%` }}
                    />
                </div>
            )}

            {open && (
                <div className="border-t border-pulse-border px-4 pt-1 pb-3.5">
                    <p className="font-pulse text-[0.8125rem] text-pulse-dim pt-[0.625rem] pb-1.5 leading-[1.6]">
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
