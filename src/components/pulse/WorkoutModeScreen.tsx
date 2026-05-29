'use client';
import { useState } from 'react';
import { logKey, parseMaxSets, computeLastSession } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import type { RoutineExercise, Logs, LogEntry, Unit, WorkoutVariant } from '@/lib/pulse/types';

interface Props {
    exercises: RoutineExercise[];
    sessionId: string;
    variant: WorkoutVariant | null;
    week: number;
    logs: Logs;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    onComplete: () => Promise<void>;
    onClose: () => void;
}

export default function WorkoutModeScreen({
    exercises,
    variant,
    week,
    logs,
    unit,
    onSave,
    onDelete,
    onComplete,
    onClose,
}: Props) {
    const [exerciseIdx, setExerciseIdx] = useState(0);
    const [completing, setCompleting] = useState(false);

    const re = exercises[exerciseIdx];
    const isFirst = exerciseIdx === 0;
    const isLast = exerciseIdx === exercises.length - 1;
    const maxSets = parseMaxSets(re.sets);
    const lastSession = computeLastSession(logs, re.id, week);

    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, re.id, i)).filter(
        (k) => logs[k]?.saved,
    ).length;

    async function handleFinish() {
        setCompleting(true);
        await onComplete();
        setCompleting(false);
    }

    return (
        <div className="fixed inset-0 z-50 bg-pulse-bg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-pulse-border">
                <button
                    aria-label="previous exercise"
                    onClick={() => setExerciseIdx((i) => i - 1)}
                    disabled={isFirst}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-pulse-border text-pulse-dim disabled:opacity-30 cursor-pointer disabled:cursor-default">
                    ‹
                </button>
                <div className="text-center">
                    <div className="font-pulse text-[0.6875rem] tracking-[0.08em] uppercase text-pulse-muted">
                        <span>Exercise {exerciseIdx + 1} of {exercises.length}</span>
                        {variant ? <span> · Variant {variant}</span> : null}
                    </div>
                </div>
                <button
                    aria-label="close"
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-pulse-border text-pulse-dim cursor-pointer">
                    ✕
                </button>
            </div>

            {/* Exercise content */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
                <h2 className="font-pulse text-xl font-bold text-pulse-text mb-1">{re.exercise.name}</h2>
                <p className="font-pulse text-sm text-pulse-muted mb-5">
                    {re.sets} sets · {re.reps} reps
                    {lastSession ? ` · Last: ${lastSession.kg}kg × ${lastSession.reps}` : ''}
                </p>

                <div className="flex flex-col gap-2">
                    {Array.from({ length: maxSets }, (_, s) => {
                        const key = logKey(week, re.id, s);
                        const prevKey = logKey(week - 1, re.id, s);
                        const prevEntry = week > 1 ? logs[prevKey] : undefined;
                        return (
                            <SetLogger
                                key={key}
                                setIdx={s}
                                week={week}
                                type={re.workout_type}
                                entry={logs[key]}
                                previousEntry={prevEntry?.saved ? prevEntry : undefined}
                                unit={unit}
                                onSave={(entry) => onSave(key, entry)}
                                onDelete={() => onDelete(key)}
                            />
                        );
                    })}
                </div>

                <div className="mt-3 font-pulse text-xs text-pulse-muted">
                    {savedCount} / {maxSets} sets logged
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-6 pt-3 border-t border-pulse-border flex flex-col gap-2">
                {!isLast ? (
                    <button
                        aria-label="next exercise"
                        onClick={() => setExerciseIdx((i) => i + 1)}
                        className="font-pulse w-full py-3 rounded-xl bg-pulse-accent text-black font-semibold text-sm cursor-pointer border-none">
                        Next exercise →
                    </button>
                ) : (
                    <button
                        aria-label="finish workout"
                        onClick={handleFinish}
                        disabled={completing}
                        className="font-pulse w-full py-3 rounded-xl bg-pulse-accent text-black font-semibold text-sm cursor-pointer border-none disabled:opacity-60">
                        {completing ? 'Finishing…' : 'Finish workout ✓'}
                    </button>
                )}
                {!isLast && (
                    <button
                        aria-label="finish workout"
                        onClick={handleFinish}
                        disabled={completing}
                        className="font-pulse w-full py-2 rounded-xl text-pulse-muted text-sm cursor-pointer border-none bg-transparent">
                        Finish workout early
                    </button>
                )}
            </div>
        </div>
    );
}
