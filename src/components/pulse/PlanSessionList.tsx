'use client';
import { useState } from 'react';
import { useMediaQuery } from '@/hooks/pulse/useMediaQuery';
import { exerciseReason, formatPrescription } from '@/lib/pulse/utils';
import { EQUIPMENT_LABELS } from '@/lib/pulse/constants';
import type { RoutineExercise } from '@/lib/pulse/types';

// One session's view-model for the Plan list: the grouped exercises plus the
// derived header facts (estimated duration, total sets, focus line). Built in
// ProgramView; this component only presents it.
export interface PlanSession {
    key: string;
    label: string;
    durationMin: number;
    setCount: number;
    focus: string;
    exercises: RoutineExercise[];
}

interface Props {
    sessions: PlanSession[];
    onSwap: (re: RoutineExercise) => void;
    onInfo: (ex: { id: string; name: string }) => void;
}

function ClockIcon() {
    return (
        <svg
            className="mr-0.5 inline-block h-3 w-3 align-[-2px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </svg>
    );
}

function ExerciseRow({
    re,
    index,
    onSwap,
    onInfo,
}: {
    re: RoutineExercise;
    index: number;
    onSwap: (re: RoutineExercise) => void;
    onInfo: (ex: { id: string; name: string }) => void;
}) {
    const reason = re.exercise ? exerciseReason(re.exercise) : null;
    const equipment = re.exercise?.equipment ?? [];
    return (
        <div className="flex items-start gap-3 border-b border-pulse-border py-3 last:border-b-0">
            <span className="w-[18px] shrink-0 pt-0.5 font-pulse text-[0.7rem] tabular-nums text-pulse-muted">
                {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
                <div className="font-pulse text-[0.94rem] font-medium tracking-[-0.01em] text-pulse-text">
                    {re.exercise?.name ?? ''}
                </div>
                <div className="mt-0.5 font-pulse-body text-[0.66rem] tracking-[0.04em] text-pulse-dim">
                    {re.sets} sets · {formatPrescription(re.reps, re.exercise?.prescription_unit, re.exercise?.default_reps)}
                </div>
                {reason && (
                    <div className="mt-1 font-pulse text-[0.72rem] leading-[1.4] text-pulse-muted">{reason}</div>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                    {equipment.length === 0 ? (
                        <span className="rounded border border-pulse-border px-1.5 py-0.5 font-pulse text-[0.625rem] tracking-[0.02em] text-pulse-muted">
                            Bodyweight
                        </span>
                    ) : (
                        equipment.map((eq) => (
                            <span
                                key={eq}
                                className="rounded border border-pulse-border px-1.5 py-0.5 font-pulse text-[0.625rem] tracking-[0.02em] text-pulse-muted">
                                {EQUIPMENT_LABELS[eq] ?? eq}
                            </span>
                        ))
                    )}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 self-center">
                <button
                    type="button"
                    onClick={() => onSwap(re)}
                    aria-label={`Swap ${re.exercise?.name ?? 'exercise'}`}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-pulse-surface-2 px-2.5 py-1.5 font-pulse text-[0.72rem] font-semibold text-pulse-dim hover:text-pulse-accent">
                    ⇄ Swap
                </button>
                {re.exercise && re.exercise.user_id === null && (
                    <button
                        type="button"
                        onClick={() => onInfo({ id: re.exercise!.id, name: re.exercise!.name })}
                        aria-label={`How to perform ${re.exercise.name}`}
                        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg border-none bg-pulse-surface-2 text-pulse-dim hover:text-pulse-accent">
                        <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            aria-hidden>
                            <circle cx="8" cy="8" r="6.5" />
                            <line x1="8" y1="7" x2="8" y2="11" strokeLinecap="round" />
                            <circle cx="8" cy="4.75" r="0.6" fill="currentColor" stroke="none" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}

// Sessions breakdown. Mobile + tablet: a chip selector showing one session at a
// time. Desktop (>=1024px): a single-open accordion (opening one closes the
// others, which caps the per-exercise "why" line density). The exercise row is
// the single source of truth shared by both modes.
export default function PlanSessionList({ sessions, onSwap, onInfo }: Props) {
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const [selected, setSelected] = useState(0);
    const [open, setOpen] = useState(0);

    if (sessions.length === 0) return null;

    if (isDesktop) {
        return (
            <div>
                {sessions.map((s, i) => {
                    const isOpen = open === i;
                    return (
                        <div key={s.key} className="mb-2.5 overflow-hidden rounded-2xl bg-pulse-surface last:mb-0">
                            <button
                                type="button"
                                onClick={() => setOpen(isOpen ? -1 : i)}
                                aria-expanded={isOpen}
                                className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent p-[15px] text-left">
                                <span className="min-w-0">
                                    <span className="block font-pulse text-[0.96rem] font-semibold text-pulse-text">
                                        {s.label}
                                    </span>
                                    <span className="mt-0.5 block font-pulse text-[0.72rem] text-pulse-muted">
                                        <ClockIcon />~{s.durationMin} min · {s.setCount} sets · {s.focus}
                                    </span>
                                </span>
                                <svg
                                    className={`h-4 w-4 shrink-0 text-pulse-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2.4}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden>
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                            {isOpen && (
                                <div className="px-[15px] pb-1.5">
                                    {s.exercises.map((re, idx) => (
                                        <ExerciseRow key={re.id} re={re} index={idx} onSwap={onSwap} onInfo={onInfo} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    const current = sessions[selected] ?? sessions[0];
    return (
        <div>
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {sessions.map((s, i) => (
                    <button
                        key={s.key}
                        type="button"
                        onClick={() => setSelected(i)}
                        aria-pressed={i === selected}
                        className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 py-1.5 font-pulse text-[0.78rem] ${
                            i === selected
                                ? 'border-transparent bg-pulse-accent font-semibold text-pulse-bg'
                                : 'border-pulse-border bg-pulse-surface-2 font-medium text-pulse-dim'
                        }`}>
                        {s.label}
                    </button>
                ))}
            </div>
            <div className="rounded-2xl bg-pulse-surface p-4">
                <div className="font-pulse text-base font-semibold tracking-[-0.01em] text-pulse-text">
                    {current.label}
                </div>
                <div className="mt-0.5 font-pulse text-[0.72rem] text-pulse-muted">
                    <ClockIcon />~{current.durationMin} min · {current.setCount} sets · {current.exercises.length}{' '}
                    exercises
                </div>
                <div className="mb-0.5 mt-1.5 font-pulse text-[0.74rem] text-pulse-accent">{current.focus}</div>
                {current.exercises.map((re, idx) => (
                    <ExerciseRow key={re.id} re={re} index={idx} onSwap={onSwap} onInfo={onInfo} />
                ))}
            </div>
        </div>
    );
}
