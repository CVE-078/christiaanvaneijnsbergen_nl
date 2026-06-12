'use client';
import { useState } from 'react';
import ExerciseCard from './ExerciseCard';
import { resolveExercise, swapKey } from '@/lib/pulse/utils';
import type {
    RoutineExercise,
    Logs,
    LogEntry,
    Unit,
    Notes,
    Swaps,
    DbExercise,
    LastSession,
} from '@/lib/pulse/types';

interface Props {
    pair: [RoutineExercise, RoutineExercise];
    pairIdx: number;
    week: number;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    notes: Notes;
    onSaveNote: (routineExerciseId: string, note: string) => Promise<void>;
    onDeleteNote: (routineExerciseId: string) => Promise<void>;
    // Swap wiring, mirrors the standalone-card branch in LogView. When provided,
    // each exercise in the pair gets the same Swap control, swapped-state badge,
    // and display-exercise resolution that a non-superset card has. Omitting them
    // (e.g. in a context with no swaps) simply hides the swap affordance.
    swaps?: Swaps;
    exercisesById?: Map<string, DbExercise>;
    lastSessionMap?: Map<string, LastSession>;
    onSwap?: (re: RoutineExercise) => void;
    onRevert?: (re: RoutineExercise) => void;
}

export default function SupersetCard({
    pair,
    pairIdx,
    week,
    logs,
    prMap,
    unit,
    onSave,
    onDelete,
    notes,
    onSaveNote,
    onDeleteNote,
    swaps,
    exercisesById,
    lastSessionMap,
    onSwap,
    onRevert,
}: Props) {
    const [open, setOpen] = useState(false);
    const [first, second] = pair;

    // Per-exercise swap props, computed exactly like LogView's standalone branch.
    // Returns {} when the swap deps are absent so the inner card hides the control.
    const swapPropsFor = (re: RoutineExercise) =>
        onSwap && swaps && exercisesById
            ? {
                  displayExercise: resolveExercise(re, week, swaps, exercisesById),
                  isSwapped: !!swaps[swapKey(week, re.id)],
                  originalName: (exercisesById.get(re.exercise_id) ?? re.exercise).name,
                  lastSession: lastSessionMap?.get(re.id) ?? null,
                  onSwap: () => onSwap(re),
                  onRevert: onRevert ? () => onRevert(re) : undefined,
              }
            : {};

    return (
        <div className="bg-pulse-surface-2 rounded-2xl overflow-hidden">
            {/* Header: superset badge, stacked exercise names (primary + dimmed secondary),
                no per-card alternating cue (repetitive at scale; cue lives in the open body). */}
            <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? 'Collapse superset' : 'Expand superset'}
                className="w-full flex items-center gap-3.5 px-[1.125rem] py-4 bg-transparent border-none cursor-pointer text-left">
                <div className="flex-1 min-w-0">
                    <span className="inline-block rounded-md bg-pulse-accent/10 px-2 py-0.5 font-pulse text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-pulse-accent">
                        Superset
                    </span>
                    <div className="mt-1.5 font-pulse text-[0.9375rem] font-semibold tracking-[-0.01em] text-pulse-text leading-snug">
                        {first.exercise.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="font-pulse text-[0.6875rem] text-pulse-muted">+</span>
                        <span className="font-pulse text-[0.8125rem] text-pulse-dim tracking-[-0.005em]">
                            {second.exercise.name}
                        </span>
                    </div>
                </div>
                <svg
                    className={`w-4 h-4 text-pulse-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {/* Expanded body: alternating cue once at top, then one card per exercise. */}
            {open && (
                <div className="flex flex-col gap-2 px-2 pb-2">
                    <p className="font-pulse-body text-[0.625rem] tracking-[0.04em] text-pulse-muted px-1 pb-0.5">
                        Alternate between exercises, then rest after both sets.
                    </p>
                    <ExerciseCard
                        routineExercise={first}
                        exIdx={pairIdx}
                        week={week}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={onSave}
                        onDelete={onDelete}
                        note={notes[`${week}-${first.id}`]}
                        onSaveNote={(n) => onSaveNote(first.id, n)}
                        onDeleteNote={() => onDeleteNote(first.id)}
                        {...swapPropsFor(first)}
                    />
                    <ExerciseCard
                        routineExercise={second}
                        exIdx={pairIdx + 1}
                        week={week}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={onSave}
                        onDelete={onDelete}
                        note={notes[`${week}-${second.id}`]}
                        onSaveNote={(n) => onSaveNote(second.id, n)}
                        onDeleteNote={() => onDeleteNote(second.id)}
                        {...swapPropsFor(second)}
                    />
                </div>
            )}
        </div>
    );
}
