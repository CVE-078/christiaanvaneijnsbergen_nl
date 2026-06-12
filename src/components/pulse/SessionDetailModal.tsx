'use client';
import { useEffect, useState } from 'react';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import { toDisplay } from '@/lib/pulse/utils';
import { formatLogDate } from '@/lib/pulse/dates';
import type { WorkoutType, Unit } from '@/lib/pulse/types';
import type { Workout, WorkoutExercise } from '@/lib/pulse/workouts';

interface Props {
    open: boolean;
    workout: Workout | null;
    unit: Unit;
    onClose: () => void;
}

function workoutTitle(w: Workout): string {
    const label = WORKOUT_TYPE_LABELS[w.workoutType as WorkoutType] ?? w.workoutType;
    return w.variant ? `${label} ${w.variant}` : label;
}

// Rep label for the collapsed row: a single number when every set matches,
// else a min-max range.
function repLabel(ex: WorkoutExercise): string {
    const reps = ex.sets.map((s) => s.reps);
    const min = Math.min(...reps);
    const max = Math.max(...reps);
    return min === max ? `${min}` : `${min}-${max}`;
}

// One small labelled stat in the summary strip.
function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="font-pulse text-[0.6rem] tracking-[0.08em] uppercase text-pulse-muted">{label}</div>
            <div className="font-pulse text-[0.95rem] font-medium text-pulse-text mt-[2px]">{value}</div>
        </div>
    );
}

function Chevron({ open }: { open: boolean }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`shrink-0 text-pulse-muted transition-transform ${open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

// Bottom-sheet on mobile, centered dialog on desktop. Mirrors the shell used
// by MetricHistoryModal.
export default function SessionDetailModal({ open, workout, unit, onClose }: Props) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        setExpandedIds(new Set());
    }, [workout?.id]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open || !workout) return null;

    const title = workoutTitle(workout);
    const today = new Date().toISOString().split('T')[0];
    const dateLabel = formatLogDate(workout.date.split('T')[0], today);

    // Total volume load = sum of weight x reps across every set.
    const totalVolumeKg = workout.exercises.reduce(
        (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.kg * set.reps, 0),
        0,
    );
    const volumeLabel = `${Math.round(toDisplay(totalVolumeKg, unit)).toLocaleString('en-GB')} ${unit}`;

    function toggleExercise(reId: string) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(reId)) next.delete(reId);
            else next.add(reId);
            return next;
        });
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center"
            onClick={onClose}>
            <div
                className="flex w-full max-w-[560px] max-h-[86vh] flex-col rounded-t-[20px] bg-pulse-surface pb-5 lg:max-h-[78vh] lg:rounded-[18px] lg:mx-6"
                onClick={(e) => e.stopPropagation()}>
                {/* Grip handle, mobile only */}
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-pulse-border lg:hidden" aria-hidden />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-3 pb-3">
                    <span className="font-pulse-display font-bold text-[1.3rem] text-pulse-text leading-tight">
                        {title}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="cursor-pointer border-none bg-transparent font-pulse text-[1.05rem] leading-none text-pulse-muted hover:text-pulse-text">
                        &#x2715;
                    </button>
                </div>

                {/* Summary strip */}
                <div className="grid grid-cols-4 gap-3 px-6 pb-4 mb-1 border-b border-pulse-border">
                    <Stat label="Date" value={dateLabel} />
                    <Stat label="Duration" value={workout.durationMin !== null ? `${workout.durationMin} min` : '—'} />
                    <Stat label="Exercises" value={String(workout.exercises.length)} />
                    <Stat label="Volume" value={volumeLabel} />
                </div>

                {/* Exercise breakdown: collapsible rows */}
                <div className="overflow-y-auto px-6 pb-1 flex-1">
                    {workout.exercises.length === 0 && (
                        <p className="py-6 text-center font-pulse text-sm text-pulse-muted">No set data available.</p>
                    )}
                    {workout.exercises.map((ex) => {
                        const isOpen = expandedIds.has(ex.routineExerciseId);
                        return (
                            <div key={ex.routineExerciseId} className="border-b border-pulse-border last:border-b-0">
                                {/* Collapsed row: name + weight (left) | reps + sets (right) */}
                                <button
                                    type="button"
                                    onClick={() => toggleExercise(ex.routineExerciseId)}
                                    aria-expanded={isOpen}
                                    className="w-full flex items-center justify-between gap-3 py-[13px] text-left cursor-pointer border-none bg-transparent">
                                    <div className="min-w-0">
                                        <div className="font-pulse text-[0.9rem] text-pulse-text overflow-hidden text-ellipsis whitespace-nowrap">
                                            {ex.name}
                                        </div>
                                        <div className="font-pulse-body text-[0.75rem] text-pulse-muted mt-[2px]">
                                            {toDisplay(ex.maxKg, unit)} {unit}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                            <div className="font-pulse text-[0.85rem] font-medium text-pulse-text">
                                                {repLabel(ex)} reps
                                            </div>
                                            <div className="font-pulse-body text-[0.75rem] text-pulse-muted mt-[2px]">
                                                {ex.setCount} {ex.setCount === 1 ? 'set' : 'sets'}
                                            </div>
                                        </div>
                                        <Chevron open={isOpen} />
                                    </div>
                                </button>

                                {/* Expanded per-set rows */}
                                {isOpen && (
                                    <div className="pb-[12px] flex flex-col gap-[6px]">
                                        {ex.sets.map((set, idx) => (
                                            <div key={idx} className="flex items-center gap-3 pl-1">
                                                <span className="font-pulse text-[0.72rem] text-pulse-muted w-12 shrink-0">
                                                    Set {idx + 1}
                                                </span>
                                                <span className="font-pulse text-[0.87rem] text-pulse-text flex-1">
                                                    {toDisplay(set.kg, unit)} {unit} × {set.reps}
                                                </span>
                                                <span className="font-pulse text-[0.75rem] text-pulse-muted shrink-0">
                                                    {set.rir} RIR
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
