'use client';
import { useEffect } from 'react';
import { computeE1RMHistory, computeBestSets, toDisplay } from '@/lib/pulse/utils';
import { exerciseSetsByWeek } from '@/lib/pulse/workouts';
import E1RMChart from '@/components/pulse/E1RMChart';
import type { Logs, Unit } from '@/lib/pulse/types';

interface Props {
    open: boolean;
    routineExerciseId: string;
    name: string;
    logs: Logs;
    unit: Unit;
    onClose: () => void;
}

export default function ExerciseDetailModal({ open, routineExerciseId, name, logs, unit, onClose }: Props) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const history = computeE1RMHistory(logs, routineExerciseId);
    const best = computeBestSets(logs)[routineExerciseId] ?? null;
    const weeklyHistory = exerciseSetsByWeek(logs, routineExerciseId);

    const prLine = best
        ? `PR ${toDisplay(best.e1rm, unit).toFixed(0)} ${unit} e1RM · best set ${toDisplay(best.kg, unit)} ${unit} × ${best.reps}`
        : null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={name}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center"
            onClick={onClose}>
            <div
                className="flex w-full max-w-[560px] max-h-[86vh] flex-col rounded-t-[20px] bg-pulse-surface pb-5 lg:max-h-[78vh] lg:rounded-[18px] lg:mx-6"
                onClick={(e) => e.stopPropagation()}>
                {/* Grip handle, mobile only */}
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-pulse-border lg:hidden" aria-hidden />

                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-3 pb-3">
                    <div className="min-w-0 pr-4">
                        <div className="font-pulse-display font-bold text-[1.3rem] text-pulse-text leading-tight truncate">
                            {name}
                        </div>
                        {prLine && (
                            <div className="font-pulse text-[0.75rem] text-pulse-muted mt-[3px]">{prLine}</div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="cursor-pointer border-none bg-transparent font-pulse text-[1.05rem] leading-none text-pulse-muted hover:text-pulse-text shrink-0 mt-[3px]">
                        &#x2715;
                    </button>
                </div>

                {/* e1RM chart */}
                <div className="px-6 pb-3">
                    <E1RMChart history={history} unit={unit} />
                </div>

                {/* Per-week history */}
                <div className="overflow-y-auto px-6 pb-1 flex-1">
                    {weeklyHistory.length === 0 ? (
                        <p className="py-6 text-center font-pulse text-sm text-pulse-muted">No sets logged yet.</p>
                    ) : (
                        <>
                            <div className="font-pulse text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-pulse-muted mb-3 pt-1">
                                History
                            </div>
                            {weeklyHistory.map(({ week, sets }) => (
                                <div key={week} className="mb-4">
                                    <div className="font-pulse text-[0.75rem] font-medium text-pulse-dim mb-[6px]">
                                        Week {week}
                                    </div>
                                    <div className="flex flex-col gap-[6px]">
                                        {sets.map((set, idx) => (
                                            <div key={idx} className="flex items-center gap-3 pl-1">
                                                <span className="font-pulse text-[0.72rem] text-pulse-muted w-12 shrink-0">
                                                    Set {idx + 1}
                                                </span>
                                                <span className="font-pulse text-[0.87rem] text-pulse-text flex-1">
                                                    {toDisplay(set.kg, unit)} {unit} &times; {set.reps}
                                                </span>
                                                <span className="font-pulse text-[0.75rem] text-pulse-muted shrink-0">
                                                    {set.rir} RIR
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
